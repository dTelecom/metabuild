package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/http/httputil"
	"os"
	"strconv"
	"sync"
	"time"

	"encoding/base64"
	"github.com/eteu-technologies/near-api-go/pkg/client"
	"github.com/eteu-technologies/near-api-go/pkg/client/block"
	"github.com/eteu-technologies/near-api-go/pkg/config"
	"github.com/eteu-technologies/near-api-go/pkg/types"
	"github.com/eteu-technologies/near-api-go/pkg/types/action"
	"github.com/eteu-technologies/near-api-go/pkg/types/key"
	"github.com/eteu-technologies/near-api-go/pkg/types/signature"

	"github.com/go-logr/logr"
	"github.com/mr-tron/base58"
	"github.com/pion/ion-sfu/pkg/sfu"
	"github.com/pion/webrtc/v3"
	"github.com/sourcegraph/jsonrpc2"
)

//Conference session
type Conference struct {
	UID                string
	CallBackURL        string
	OnlineParticipants sync.Map
	EndedParticipants  sync.Map
	EndedAt            time.Time
	StartedAt          time.Time
	CallID             string
	AccountID          string
	Host               string
	Session            *sfu.SessionLocal
}

//Participant peer
type Participant struct {
	UID       string
	Stream    string
	AddedAt   time.Time
	RemovedAt time.Time
}

// Conferences global map conferences
var Conferences sync.Map

// Join message sent when initializing a peer connection
type Join struct {
	SID    string                    `json:"sid"`
	UID    string                    `json:"uid"`
	Offer  webrtc.SessionDescription `json:"offer"`
	Config sfu.JoinConfig            `json:"config"`
}

// Negotiation message sent when renegotiating the peer connection
type Negotiation struct {
	Desc webrtc.SessionDescription `json:"desc"`
}

// Trickle message sent when renegotiating the peer connection
type Trickle struct {
	Target    int                     `json:"target"`
	Candidate webrtc.ICECandidateInit `json:"candidate"`
}

// ConferenceUser model
type ConferenceUser struct {
	SID         string `json:"sid"`
	UID         string `json:"uid"`
	CallID      string `json:"callId"`
	CallBackURL string `json:"callBackURL"`
	AccountID   string `json:"AccountId"`
}

//ViewResult generic
type ViewResult struct {
	Result []byte `json:"result"`
}

// GetCallsResult r
type GetCallsResult struct {
	ID                 string `json:"id"`
	ClientID           string `json:"client_id"`
	NodeID             string `json:"node_id"`
	ClientLockedAmount int64  `json:"client_locked_amount"`
	NodeLockedAmount   int    `json:"node_locked_amount"`
	NodeMinutes        int    `json:"node_minutes"`
	ClientMinutes      int    `json:"client_minutes"`
	NodeEndedAt        int    `json:"node_ended_at"`
	ClientEndedAt      int    `json:"client_ended_at"`
}

// SignatureView json
type SignatureView struct {
	Signature string `json:"signature"`
	Epoch     uint64 `json:"epoch"`
}

// JSONSignal struct
type JSONSignal struct {
	*sfu.PeerLocal
	logr.Logger
}

// NewJSONSignal create new JSONSignal
func NewJSONSignal(p *sfu.PeerLocal, l logr.Logger) *JSONSignal {
	return &JSONSignal{p, l}
}

// Handle incoming RPC call events like join, answer, offer and trickle
func (p *JSONSignal) Handle(ctx context.Context, conn *jsonrpc2.Conn, req *jsonrpc2.Request) {
	replyError := func(err error) {
		_ = conn.ReplyWithError(ctx, req.ID, &jsonrpc2.Error{
			Code:    500,
			Message: fmt.Sprintf("%s", err),
		})
	}

	switch req.Method {
	case "join":
		var join Join
		err := json.Unmarshal(*req.Params, &join)
		if err != nil {
			p.Logger.Error(err, "connect: error parsing offer")
			replyError(err)
			break
		}

		var conferenceUser ConferenceUser
		err = json.Unmarshal([]byte(join.SID), &conferenceUser)
		if err != nil {
			p.Logger.Error(err, "connect: error parsing offer")
			replyError(err)
			break
		}

		sid := conferenceUser.SID
		uid := conferenceUser.UID

		if ival, ok := Conferences.Load(sid); ok {
			conference := ival.(Conference)
			if conference.EndedAt.IsZero() == false {
				err := fmt.Errorf("ended conference")
				p.Logger.Error(err, "connect: ended conference")
				replyError(err)
				break
			}
			if _, ok := conference.OnlineParticipants.Load(uid); ok {
				err := fmt.Errorf("uid exist")
				p.Logger.Error(err, "connect: uid exist")
				replyError(err)
				break
			}
		}

		keys, keyErr := getKeys(conferenceUser.AccountID)
		if keyErr != nil {
			p.Logger.Error(keyErr, "connect: error parsing offer")
			replyError(keyErr)
			break
		}

		sign, _ := base64.StdEncoding.DecodeString(join.UID)
		signature := signature.NewSignatureED25519(sign)

		verified := false
		for _, k := range keys {
			if k.AccessKey.Permission.FullAccess == true {

				publicKey := k.PublicKey.ToPublicKey()
				ok, _ := publicKey.Verify([]byte(join.SID), signature)

				if ok == true {
					verified = true
					break
				}
			}
		}

		if verified == false {
			err := fmt.Errorf("verify error")
			p.Logger.Error(err, "connect: verify error")
			replyError(err)
			break
		}

		p.OnOffer = func(offer *webrtc.SessionDescription) {
			if err := conn.Notify(ctx, "offer", offer); err != nil {
				p.Logger.Error(err, "error sending offer")
			}

		}
		p.OnIceCandidate = func(candidate *webrtc.ICECandidateInit, target int) {
			if err := conn.Notify(ctx, "trickle", Trickle{
				Candidate: *candidate,
				Target:    target,
			}); err != nil {
				p.Logger.Error(err, "error sending ice candidate")
			}
		}

		err = p.Join(sid, uid, join.Config)
		if err != nil {
			replyError(err)
			break
		}

		if p.Session() != nil {
			if len(p.Session().Peers()) > 9 {
				err := fmt.Errorf("too many participants")
				p.Logger.Error(err, "connect: too many participants")
				replyError(err)
				p.Close()
				break
			}
		}

		answer, err := p.Answer(join.Offer)
		if err != nil {
			replyError(err)
			p.Close()
			break
		}

		addParticipantHandler := func(track sfu.PublisherTrack) {
			streamID := track.Track.StreamID()

			var conference Conference
			if ival, ok := Conferences.Load(p.Session().ID()); ok {
				conference = ival.(Conference)
			} else {
				conference = Conference{
					UID:         p.Session().ID(),
					CallBackURL: conferenceUser.CallBackURL,
					CallID:      conferenceUser.CallID,
					AccountID:   conferenceUser.AccountID,
					Host:        p.ID(),
					Session:     p.Session().(*sfu.SessionLocal),
				}
				go conference.observer()
			}

			if _, ok := conference.OnlineParticipants.Load(p.ID()); !ok {
				participant := Participant{
					UID:     p.ID(),
					Stream:  streamID,
					AddedAt: time.Now(),
				}

				conference.OnlineParticipants.Store(p.ID(), participant)
				shouldCreate := false
				if conference.StartedAt.IsZero() == true {
					conference.StartedAt = time.Now()
					shouldCreate = true
				}
				Conferences.Store(p.Session().ID(), conference)
				go notifyAddParticipant(conference.CallBackURL, p.Session().ID(), p.ID(), streamID, conference.GetDuration(), shouldCreate, conferenceUser.CallID, conferenceUser.AccountID)
			}
		}

		p.Publisher().OnPublisherTrack(addParticipantHandler)

		removeParticipantHandler := func(connectionState webrtc.ICEConnectionState) {
			if connectionState == webrtc.ICEConnectionStateClosed {

				var conference Conference
				if ival, ok := Conferences.Load(p.Session().ID()); ok {
					conference = ival.(Conference)

					if ivalp, ok := conference.OnlineParticipants.Load(p.ID()); ok {
						participant := ivalp.(Participant)
						participant.RemovedAt = time.Now()

						conference.OnlineParticipants.Delete(p.ID())
						conference.EndedParticipants.Store(participant.Stream, participant)
						Conferences.Store(p.Session().ID(), conference)
					}

					go notifyRemoveParticipant(conference.CallBackURL, p.Session().ID(), p.ID(), conference.GetDuration())

					if len(p.Session().Peers()) == 0 {
						if ivalc, ok := Conferences.Load(p.Session().ID()); ok {
							conference := ivalc.(Conference)
							conference.EndedAt = time.Now()
							Conferences.Store(p.Session().ID(), conference)

							go notifyRemoveConference(conference.CallBackURL, p.Session().ID(), conference.GetDuration(), conferenceUser.CallID, conferenceUser.AccountID)
						}
					}
				}

			}
		}

		p.Publisher().OnICEConnectionStateChange(removeParticipantHandler)

		_ = conn.Reply(ctx, req.ID, answer)

	case "offer":
		var negotiation Negotiation
		err := json.Unmarshal(*req.Params, &negotiation)
		if err != nil {
			p.Logger.Error(err, "connect: error parsing offer")
			replyError(err)
			p.Close()
			break
		}

		answer, err := p.Answer(negotiation.Desc)
		if err != nil {
			replyError(err)
			p.Close()
			break
		}
		_ = conn.Reply(ctx, req.ID, answer)

	case "answer":
		var negotiation Negotiation
		err := json.Unmarshal(*req.Params, &negotiation)
		if err != nil {
			p.Logger.Error(err, "connect: error parsing answer")
			replyError(err)
			p.Close()
			break
		}

		err = p.SetRemoteDescription(negotiation.Desc)
		if err != nil {
			replyError(err)
			p.Close()
		}

	case "trickle":
		var trickle Trickle
		err := json.Unmarshal(*req.Params, &trickle)
		if err != nil {
			p.Logger.Error(err, "connect: error parsing candidate")
			replyError(err)
			p.Close()
			break
		}

		err = p.Trickle(trickle.Candidate, trickle.Target)
		if err != nil {
			replyError(err)
		}

	case "end":
		if ival, ok := Conferences.Load(p.Session().ID()); ok {
			conference := ival.(Conference)
			if conference.Host == p.ID() {
				for _, peer := range p.Session().Peers() {
					peer.Close()
				}
			} else {
				p.Close()
			}
		}
	}
}

// GetDuration in minutes
func (conference *Conference) GetDuration() int {
	duration := 0.0
	conference.EndedParticipants.Range(func(k, v interface{}) bool {
		participant := v.(Participant)
		difference := participant.RemovedAt.Sub(participant.AddedAt)
		duration += difference.Seconds()
		return true
	})
	minutes := int(math.Ceil(duration / 60.0))
	return minutes
}

func getKeys(clientID string) ([]client.AccessKeyViewInfo, error) {
	var res []client.AccessKeyViewInfo
	network, ok := config.Networks["mainnet"]
	if !ok {
		return res, fmt.Errorf("unknown network")
	}

	rpc, err := client.NewClient(network.NodeURL)
	if err != nil {
		return res, fmt.Errorf("failed to create rpc client: %w", err)
	}

	ctx := context.Background()
	accessKeyViewListResp, err := rpc.AccessKeyViewList(ctx, clientID, block.FinalityFinal())
	if err != nil {
		return res, fmt.Errorf("failed to query access key list: %w", err)
	}

	return accessKeyViewListResp.Keys, nil
}

func createCall(callID string, clientID string, signb64 string, epoch uint64) error {
	keyPair, err := key.NewBase58KeyPair(os.Getenv("NEAR_PK"))
	if err != nil {
		log.Printf("createCall err: %v\n", err)
		return fmt.Errorf("key error: %w", err)
	}

	network, ok := config.Networks["mainnet"]
	if !ok {
		log.Printf("createCall err: %v\n", "unknown network")
		return fmt.Errorf("unknown network '%s'", "mainnet")
	}

	rpc, err := client.NewClient(network.NodeURL)
	if err != nil {
		log.Printf("createCall err: %v\n", err)
		return fmt.Errorf("failed to create rpc client: %w", err)
	}

	var deposit types.Balance = types.NEARToYocto(0)
	var gas types.Gas = 100000000000000

	sign, err := base64.StdEncoding.DecodeString(signb64)
	if err != nil {
		log.Printf("createCall err: %v\n", err)
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	s := signature.NewSignatureED25519(sign)

	map1 := map[string]interface{}{
		"id":        callID,
		"client_id": clientID,
		"sign":      base58.Encode(s.Value()),
		"epoch":     epoch,
	}

	jsonStr, _ := json.Marshal(map1)

	ctx := client.ContextWithKeyPair(context.Background(), keyPair)
	res, err := rpc.TransactionSendAwait(
		ctx,
		os.Getenv("NEAR_ACCOUNT"),
		"webrtc.dtelecom.near",
		[]action.Action{
			action.NewFunctionCall("create_call", jsonStr, gas, deposit),
		},
		client.WithBlockCharacteristic(block.FinalityFinal()),
	)

	if err != nil {
		log.Printf("createCall err: %v\n", err)
		return fmt.Errorf("create_call: %w", err)
	}
	log.Printf("create_call: %v", res)
	return nil
}

func endCall(callID string, clientID string, signb64 string, epoch uint64, duration int) error {
	keyPair, err := key.NewBase58KeyPair(os.Getenv("NEAR_PK"))
	if err != nil {
		log.Printf("endCall err: %v\n", err)
		return fmt.Errorf("key error: %w", err)
	}

	network, ok := config.Networks["mainnet"]
	if !ok {
		log.Printf("endCall err: %v\n", "unknown network")
		return fmt.Errorf("unknown network '%s'", "mainnet")
	}

	rpc, err := client.NewClient(network.NodeURL)
	if err != nil {
		log.Printf("endCall err: %v\n", err)
		return fmt.Errorf("failed to create rpc client: %w", err)
	}

	var deposit types.Balance = types.NEARToYocto(0)
	var gas types.Gas = 100000000000000

	sign, err := base64.StdEncoding.DecodeString(signb64)
	if err != nil {
		log.Printf("endCall err: %v\n", err)
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	s := signature.NewSignatureED25519(sign)

	map1 := map[string]interface{}{
		"id":        callID,
		"client_id": clientID,
		"sign":      base58.Encode(s.Value()),
		"minutes":   duration,
		"epoch":     epoch,
	}

	jsonStr, _ := json.Marshal(map1)

	ctx := client.ContextWithKeyPair(context.Background(), keyPair)
	res, err := rpc.TransactionSendAwait(
		ctx,
		os.Getenv("NEAR_ACCOUNT"),
		"webrtc.dtelecom.near",
		[]action.Action{
			action.NewFunctionCall("end_call", jsonStr, gas, deposit),
		},
		client.WithBlockCharacteristic(block.FinalityFinal()),
	)

	if err != nil {
		log.Printf("endCall err: %v\n", err)
		return fmt.Errorf("end_call: %w", err)
	}
	log.Printf("end_call: %v", res)
	return nil
}

func notifyAddParticipant(baseURL string, SID string, UID string, streamID string, duration int, shouldCreate bool, callID string, accountID string) {
	url := baseURL + "/api/participant/add/" + SID + "/" + UID + "/" + streamID + "/" + strconv.Itoa(duration)

	log.Printf("notifyAddParticipant: %v", url)

	req, err := http.NewRequest("PUT", url, nil)
	if err != nil {
		log.Printf("notifyAddParticipant: %v", err)
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("notifyAddParticipant: %v", err)
	}
	defer response.Body.Close()

	b, err := io.ReadAll(response.Body)
	if err != nil {
		log.Printf("notifyAddParticipant: %v", err)
	}

	var signatureView SignatureView
	err = json.Unmarshal(b, &signatureView)
	if err != nil {
		log.Printf("notifyAddParticipant: %v", err)
	}

	if shouldCreate == true {
		createCall(callID, accountID, signatureView.Signature, signatureView.Epoch)
	}
	log.Printf("notifyAddParticipant: %v", string(b))
}

func notifyRemoveParticipant(baseURL string, SID string, UID string, duration int) {
	url := baseURL + "/api/participant/remove/" + SID + "/" + UID + "/" + strconv.Itoa(duration)

	log.Printf("notifyRemoveParticipant: %v", url)

	req, err := http.NewRequest("PUT", url, nil)
	if err != nil {
		log.Printf("notifyRemoveParticipant: %v", err)
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("notifyRemoveParticipant: %v", err)
	}
	defer response.Body.Close()

	b, err := httputil.DumpResponse(response, true)
	if err != nil {
		log.Printf("notifyRemoveParticipant: %v", err)
	}

	log.Printf("notifyRemoveParticipant: %v", string(b))
}

func notifyRemoveConference(baseURL string, SID string, duration int, callID string, accountID string) {
	url := baseURL + "/api/conference/remove/" + SID + "/" + strconv.Itoa(duration)

	log.Printf("notifyRemoveConference: %v", url)

	req, err := http.NewRequest("PUT", url, nil)
	if err != nil {
		log.Printf("notifyRemoveConference: %v", err)
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("notifyRemoveConference: %v", err)
	}
	defer response.Body.Close()

	b, err := io.ReadAll(response.Body)
	if err != nil {
		log.Printf("notifyRemoveConference: %v", err)
	}
	var signatureView SignatureView
	err = json.Unmarshal(b, &signatureView)
	if err != nil {
		log.Printf("notifyRemoveConference: %v", err)
	}

	endCall(callID, accountID, signatureView.Signature, signatureView.Epoch, duration)

	log.Printf("notifyRemoveConference: %v", string(b))
}

func (conference *Conference) observer() {
	endTime := conference.StartedAt.Add(time.Minute * 30)
	for {
		time.Sleep(time.Duration(10) * time.Second)
		if conference.EndedAt.IsZero() == false {
			break
		}
		if time.Now().After(endTime) == true {
			for _, peer := range conference.Session.Peers() {
				peer.Close()
			}
		}
	}
}
