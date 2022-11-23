package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"context"
	"encoding/base64"
	"encoding/json"
	"github.com/eteu-technologies/near-api-go/pkg/client"
	"github.com/eteu-technologies/near-api-go/pkg/client/block"
	"github.com/eteu-technologies/near-api-go/pkg/config"
	"github.com/eteu-technologies/near-api-go/pkg/types/key"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"github.com/labstack/echo"
	"github.com/lithammer/shortuuid/v4"
	"math/rand"
	"strconv"
	"time"
)

// CallBackURL str
var CallBackURL = "https://nmeet.org"

// AccountID - TODO: env
var AccountID = "nmeet.near"

// Participant model
type Participant struct {
	gorm.Model `json:"model"`
	Name       string    `json:"name"`
	UID        string    `json:"uid"`
	SID        string    `json:"sid"`
	StreamID   string    `json:"streamID"`
	URL        string    `json:"url"`
	AddedAt    time.Time `json:"addedAt"`
	RemovedAt  time.Time `json:"removedAt"`
}

// Conference model
type Conference struct {
	gorm.Model `json:"model"`
	EndedAt    time.Time `json:"endedAt"`
	SID        string    `json:"sid"`
	URL        string    `json:"url"`
	Duration   string    `json:"duration"`
	CallID     string    `json:"callId"`
}

// ConferenceUser json
type ConferenceUser struct {
	SID         string `json:"sid"`
	UID         string `json:"uid"`
	CallID      string `json:"callId"`
	CallBackURL string `json:"callBackURL"`
	AccountID   string `json:"AccountId"`
}

// ConferenceView json
type ConferenceView struct {
	SID string `json:"sid"`
	UID string `json:"uid"`
	URL string `json:"url"`
}

// SignatureView json
type SignatureView struct {
	Signature string `json:"signature"`
	Epoch     uint64 `json:"epoch"`
}

func handlerFunc(msg string) func(echo.Context) error {
	return func(c echo.Context) error {
		return c.String(http.StatusOK, msg)
	}
}

func allUsers(db *gorm.DB) func(echo.Context) error {
	return func(c echo.Context) error {
		var participants []Participant
		sid := c.QueryParam("sid")
		db.Where("s_id=?", sid).Find(&participants)

		return c.JSON(http.StatusOK, participants)
	}
}

func newConference(db *gorm.DB) func(echo.Context) error {
	return func(c echo.Context) error {
		confID := shortuuid.New()
		userID := shortuuid.New()
		callID := shortuuid.New()
		sid, uid, terr := getConferenceData(confID, userID, callID)
		if terr != nil {
			log.Printf("terr: %v", terr)
		}

		url, err := getNodeURL()
		if err == nil {
			conference := &Conference{
				SID:    confID,
				URL:    url,
				CallID: callID,
			}
			db.Create(&conference)

			name := c.Param("name")

			participant := &Participant{
				Name: name,
				UID:  userID,
				SID:  conference.SID,
				URL:  url,
			}

			db.Create(&participant)
			conferenceView := &ConferenceView{
				SID: sid,
				UID: uid,
				URL: url,
			}
			return c.JSON(http.StatusOK, conferenceView)
		}
		return c.String(http.StatusBadRequest, err.Error())
	}
}

func joinConference(db *gorm.DB) func(echo.Context) error {
	return func(c echo.Context) error {
		name := c.Param("name")
		confID := c.Param("sid")

		var conference Conference
		db.Where("s_id=?", confID).First(&conference)
		if conference.SID != confID {
			return c.String(http.StatusNotFound, "")
		}

		if conference.EndedAt.IsZero() == false {
			return c.String(http.StatusBadRequest, "ended")
		}

		userID := shortuuid.New()
		sid, uid, _ := getConferenceData(confID, userID, conference.CallID)

		participant := &Participant{
			Name: name,
			UID:  userID,
			SID:  conference.SID,
			URL:  conference.URL,
		}
		db.Create(&participant)

		conferenceView := &ConferenceView{
			SID: sid,
			UID: uid,
			URL: conference.URL,
		}

		return c.JSON(http.StatusOK, conferenceView)
	}
}

func addParticipant(db *gorm.DB) func(echo.Context) error {
	return func(c echo.Context) error {
		confID := c.Param("sid")
		userID := c.Param("uid")
		streamID := c.Param("streamID")
		duration := c.Param("duration")

		var participant Participant
		db.Where("uid=? AND s_id=?", userID, confID).First(&participant)
		if participant.UID != userID {
			return c.String(http.StatusNotFound, "")
		}

		var conference Conference
		db.Where("s_id=?", confID).First(&conference)
		if conference.SID != confID {
			return c.String(http.StatusNotFound, "")
		}

		participant.StreamID = streamID
		if participant.AddedAt.IsZero() {
			participant.AddedAt = time.Now()
		}
		db.Save(&participant)

		epoch, _ := getEpochHeight()

		sig, _ := getConfirmationSignature(conference.CallID, duration, epoch)

		signatureView := &SignatureView{
			Signature: sig,
			Epoch:     epoch,
		}

		return c.JSON(http.StatusOK, signatureView)
	}
}

func removeParticipant(db *gorm.DB) func(echo.Context) error {
	return func(c echo.Context) error {
		confID := c.Param("sid")
		userID := c.Param("uid")
		duration := c.Param("duration")

		var participant Participant
		db.Where("uid=? AND s_id=?", userID, confID).First(&participant)
		if participant.UID != userID {
			return c.String(http.StatusNotFound, "")
		}

		var conference Conference
		db.Where("s_id=?", confID).First(&conference)
		if conference.SID != confID {
			return c.String(http.StatusNotFound, "")
		}

		if participant.RemovedAt.IsZero() {
			participant.RemovedAt = time.Now()
		}
		db.Save(&participant)

		epoch, _ := getEpochHeight()

		sig, _ := getConfirmationSignature(conference.CallID, duration, epoch)
		signatureView := &SignatureView{
			Signature: sig,
			Epoch:     epoch,
		}

		return c.JSON(http.StatusOK, signatureView)
	}
}

func removeConference(db *gorm.DB) func(echo.Context) error {
	return func(c echo.Context) error {
		confID := c.Param("sid")
		duration := c.Param("duration")

		var conference Conference
		db.Where("s_id=?", confID).First(&conference)
		if conference.EndedAt.IsZero() {
			conference.EndedAt = time.Now()
			conference.Duration = duration
		}
		db.Save(&conference)

		epoch, _ := getEpochHeight()

		sig, _ := getConfirmationSignature(conference.CallID, duration, epoch)
		signatureView := &SignatureView{
			Signature: sig,
			Epoch:     epoch,
		}

		return c.JSON(http.StatusOK, signatureView)
	}
}

func handleRequest(db *gorm.DB) {
	e := echo.New()

	e.GET("/api/participants", allUsers(db))
	e.POST("/api/participant/create/:name", newConference(db))
	e.POST("/api/participant/join/:sid/:name", joinConference(db))
	e.PUT("/api/participant/add/:sid/:uid/:streamID/:duration", addParticipant(db))
	e.PUT("/api/participant/remove/:sid/:uid/:duration", removeParticipant(db))
	e.PUT("/api/conference/remove/:sid/:duration", removeConference(db))

	e.Logger.Fatal(e.Start(":3000"))
}

func initialMigration(db *gorm.DB) {

	db.AutoMigrate(&Participant{}, &Conference{})
}

func main() {
	db, err := gorm.Open("sqlite3", "sqlite3gorm.db")
	if err != nil {
		fmt.Println(err.Error())
		panic("failed to connect database")
	}
	defer db.Close()
	rand.Seed(time.Now().UnixNano())
	initialMigration(db)
	handleRequest(db)
}

//ViewResult generic
type ViewResult struct {
	Result []byte `json:"result"`
}

// GetNodesResult data
type GetNodesResult struct {
	Address      string `json:"address"`
	StakedAmount int64  `json:"staked_amount"`
	LockedAmount int    `json:"locked_amount"`
}

func getNodeURL() (string, error) {
	node := ""
	keyPair, err := key.NewBase58KeyPair(os.Getenv("NEAR_PK"))
	if err != nil {
		return node, fmt.Errorf("key error: %w", err)
	}

	network, ok := config.Networks["mainnet"]
	if !ok {
		return node, fmt.Errorf("unknown network '%s'", "mainnet")
	}

	rpc, err := client.NewClient(network.NodeURL)
	if err != nil {
		return node, fmt.Errorf("failed to create rpc client: %w", err)
	}

	ctx := client.ContextWithKeyPair(context.Background(), keyPair)

	res, err := rpc.ContractViewCallFunction(ctx, "webrtc.dtelecom.near", "get_nodes", base64.StdEncoding.EncodeToString([]byte("")), block.FinalityFinal())
	if err != nil {
		return node, fmt.Errorf("failed to view get_nodes: %w", err)
	}

	var viewResult ViewResult

	json.Unmarshal([]byte(res.Result), &viewResult)

	var getNodesResult []GetNodesResult
	json.Unmarshal(viewResult.Result, &getNodesResult)

	randomIndex := rand.Intn(len(getNodesResult))

	return getNodesResult[randomIndex].Address, nil
}

func getEpochHeight() (uint64, error) {
	var height uint64 = 0

	keyPair, err := key.NewBase58KeyPair(os.Getenv("NEAR_PK"))
	if err != nil {
		return height, fmt.Errorf("key error: %w", err)
	}

	network, ok := config.Networks["mainnet"]
	if !ok {
		return height, fmt.Errorf("unknown network '%s'", "mainnet")
	}

	rpc, err := client.NewClient(network.NodeURL)
	if err != nil {
		return height, fmt.Errorf("failed to create rpc client: %w", err)
	}

	ctx := client.ContextWithKeyPair(context.Background(), keyPair)

	res, err := rpc.ContractViewCallFunction(ctx, "webrtc.dtelecom.near", "get_epoch_height", base64.StdEncoding.EncodeToString([]byte("")), block.FinalityFinal())
	if err != nil {
		return height, fmt.Errorf("failed to view get_epoch_height: %w", err)
	}

	var viewResult ViewResult

	json.Unmarshal([]byte(res.Result), &viewResult)

	json.Unmarshal(viewResult.Result, &height)

	return height, nil
}

func getConferenceData(sid string, uid string, callID string) (string, string, error) {

	keyPair, err := key.NewBase58KeyPair(os.Getenv("NEAR_PK"))
	if err != nil {
		return "", "", fmt.Errorf("key error: %w", err)
	}

	conferenceUser := ConferenceUser{
		SID:         sid,
		UID:         uid,
		CallID:      callID,
		CallBackURL: CallBackURL,
		AccountID:   AccountID,
	}

	j, _ := json.Marshal(conferenceUser)

	log.Printf("pubKey: %v", keyPair.PublicKey)
	sig := keyPair.Sign(j)
	return string(j), base64.StdEncoding.EncodeToString(sig.Value()), nil
}

func getConfirmationSignature(callID string, duration string, epoch uint64) (string, error) {

	keyPair, err := key.NewBase58KeyPair(os.Getenv("NEAR_PK"))
	if err != nil {
		return "", fmt.Errorf("key error: %w", err)
	}

	message := callID + ":" + duration + ":" + strconv.Itoa(int(epoch))

	log.Printf("pubKey: %v", keyPair.PublicKey)
	sig := keyPair.Sign([]byte(message))
	return base64.StdEncoding.EncodeToString(sig.Value()), nil
}
