import React, {useCallback, useEffect, useRef, useState} from 'react'
import {Header} from '../../components/Header/Header';
import * as styles from './Call.module.scss'
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {Container} from '../../components/Container/Container';
import {Box, Flex} from '@chakra-ui/react';
import VideoControls from '../../components/VideoControls/VideoControls';
import {Client, LocalStream} from 'ion-sdk-js';
import {IonSFUJSONRPCSignal} from 'ion-sdk-js/lib/signal/json-rpc-impl';
import axios from 'axios';
import Footer from '../../components/Footer/Footer';
import classNames from 'classnames';
import ParticipantsBadge from '../../components/ParticipantsBadge/ParticipantsBadge';
import {ChainIcon, WhiteTickIcon} from '../../assets';
import {hideMutedBadge, showMutedBadge} from './utils';
import CopyToClipboard from 'react-copy-to-clipboard/src';
import Video from '../../components/Video/Video';
import {PackedGrid} from 'react-packed-grid';
import {useBreakpoints} from '../../hooks/useBreakpoints';
import {useMediaConstraints} from '../../hooks/useMediaConstraints';

const config = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
};

const Call = () => {
  const {isMobile} = useBreakpoints();
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const {sid} = useParams()
  const location = useLocation()
  const clientLocal = useRef()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const {
    constraints,
    onDeviceChange,
    onMediaToggle,
    audioEnabled,
    videoEnabled,
    selectedAudioId,
    selectedVideoId,
    defaultConstraints
  } = useMediaConstraints(location.state?.callState, location.state?.audioEnabled, location.state?.videoEnabled);
  const localMedia = useRef()
  const timer = useRef()
  const streamRef = useRef({})

  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
    };
  }, []);

  function onCopy() {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  const name = (location.state?.name || (Math.random() + 1).toString(36).substring(7)) + (!sid ? ' (Host)' : '');

  const started = useRef(false)

  const hangup = useCallback(() => {
    if (clientLocal.current) {
      clientLocal.current.close();
      clientLocal.current = null
      navigate('/')
    }
  }, [])

  useEffect(() => {
    void loadMedia()

    return () => {
      hangup()
    }
  }, [hangup])


  const loadMedia = async () => {
    // HACK: dev use effect fires twice
    if (started.current === true) return
    started.current = true

    await start()
  }

  const loadDevices = () => {
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        setDevices(devices)
      })
      .catch((err) => {
        console.error(`${err.name}: ${err.message}`);
      });
  }

  const start = async () => {
    try {
      let url = `https://nmeet.org/api/participant/create/${name}`;
      if (sid !== undefined) {
        url = `https://nmeet.org/api/participant/join/${sid}/${name}`;
      }
      const response = await axios.post(url);
      const parsedSID = JSON.parse(response.data.sid)
      console.log(`Created: `, response);
      console.log(`Join: `, parsedSID.sid, parsedSID.uid);

      setInviteLink(window.location.origin + '/join/' + parsedSID.sid)

      const signalLocal = new IonSFUJSONRPCSignal(response.data.url);

      clientLocal.current = new Client(signalLocal, config);

      clientLocal.current.onspeaker = (speakers) => {
        console.log('[onspeaker] speakers=', speakers)
      };

      clientLocal.current.onactivelayer = (layer) => {
        console.log('[onactivelayer] layer=', layer)
      };

      clientLocal.current.ontrack = (track, stream) => {
        console.log('got track', track, 'for stream', stream);

        track.onmute = (e) => {
          console.log(e, stream.id, 'mute');
          const type = e.srcElement.kind
          showMutedBadge(type, stream.id)
        }

        track.onunmute = (e) => {
          console.log(e, stream.id, 'onunmute');
          setTimeout(() => {
            const type = e.srcElement.kind
            hideMutedBadge(type, stream.id)
          }, 1000)
        };

        axios.get('https://nmeet.org/api/participants?sid=' + parsedSID.sid).then((response) => {
          console.log('Users:', response.data)
          setParticipants(response.data.map(participant => !participant.streamID ? {
            ...participant,
            streamID: localMedia.current.id
          } : participant));
        }).catch(console.error);

        // If the stream is not there in the streams map.
        if (!streamRef.current[stream.id]) {
          streamRef.current[stream.id] = stream
          setParticipants(prev => [...prev, {streamID: stream.id}])
        }

        stream.onremovetrack = () => {
          try {
            if (streamRef.current[stream.id]) {
              delete streamRef.current[stream.id];
              setParticipants(prev => prev.filter(participant => participant.streamID !== stream.id))
            }
          } catch (err) {
          }
        };
      };

      signalLocal.onopen = async () => {
        clientLocal.current.join(response.data.sid, response.data.uid);
        publish()
      }
    } catch (errors) {
      console.error(errors);
    }
  }

  const publish = async () => {
    LocalStream.getUserMedia({
      resolution: 'vga',
      audio: true,
      video: constraints.video || defaultConstraints.video,
      // codec: params.has('codec') ? params.get('codec') : 'vp8',
      codec: 'vp8',
      sendEmptyOnMute: false,
    }).then(async (media) => {
      loadDevices()
      localMedia.current = media
      if (constraints.audio?.exact) {
        media.switchDevice('audio', constraints.audio?.exact)
      }

      if (constraints.video?.exact) {
        media.switchDevice('video', constraints.video.exact)
      }

      streamRef.current = {[media.id]: media}
      setParticipants([
        {streamID: media.id, name},
      ])

      clientLocal.current.publish(media)

      setLoading(false)

      setTimeout(() => {
        if (!audioEnabled) {
          media.mute('audio')
          showMutedBadge('audio', media.id)
        } else {
          hideMutedBadge('audio', media.id)
        }

        if (!videoEnabled) {
          media.mute('video')
          showMutedBadge('video', media.id)
        } else {
          hideMutedBadge('video', media.id)
        }
      }, 0)
    })
      .catch(console.error);
  };

  const onDeviceSelect = useCallback((type, deviceId) => {
    if (!localMedia.current) return

    localMedia.current.switchDevice(type, deviceId)
    onDeviceChange(type, deviceId)
  }, [])

  const toggleMedia = (type) => {
    if (!!constraints[type]) {
      localMedia.current.mute(type)
      showMutedBadge(type, localMedia.current.id)
    } else {
      localMedia.current.unmute(type)
      hideMutedBadge(type, localMedia.current.id)
    }
    onMediaToggle(type)
  }

  return (
    <Box
      className={styles.container}
    >
      <Header>
        <Flex
          className={styles.headerControls}
          gap={'16px'}
        >
          <ParticipantsBadge count={participants?.length}/>
          <CopyToClipboard
            onCopy={onCopy}
            text={inviteLink}
          >
            <button className={styles.inviteButton}>
              <img
                src={copied ? WhiteTickIcon : ChainIcon}
                alt={'copy icon'}
              />
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
          </CopyToClipboard>
        </Flex>
      </Header>

      <Container
        containerClass={styles.callContainer}
        contentClass={styles.callContentContainer}
      >

        {isMobile ? (
          <Flex
            minHeight={'calc(100% - 72px)'}
            flexDirection={'row'}
            flexWrap={'wrap'}
            gap={'8px'}
            overflowY={participants.length === 1 ? 'initial' : 'auto'}
            justifyContent={'space-between'}
          >
            {participants.map((participant, index) => (
              <Box
                key={participant.streamID}
                maxHeight={participants.length === 1 ? 'auto' : 'calc((100vh - 72px - 48px - 88px) / 2)'}
                width={participants.length === 1 ? '100%' : 'calc(50% - 8px)'}
                style={{
                  aspectRatio: 360 / 640
                }}
              >
                <Video
                  key={participant.streamID + index}
                  participant={participant}
                  refs={streamRef.current}
                  muted={participant.streamID === localMedia.current.id}
                  name={participant.name}
                  setParticipants={setParticipants}
                />
              </Box>
            ))}
          </Flex>
        ) : (
          <PackedGrid
            className={classNames(styles.videoContainer)}
            boxAspectRatio={656 / 376}
          >
            {participants.map((participant, index) => (
              <Video
                key={participant.streamID + index}
                participant={participant}
                refs={streamRef.current}
                muted={participant.streamID === localMedia.current.id}
                name={participant.name}
                setParticipants={setParticipants}
              />
            ))}
          </PackedGrid>
        )}


        {!loading && (
          <div className={styles.videoControls}>
            <VideoControls
              devices={devices}
              onHangUp={hangup}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              onDeviceChange={onDeviceSelect}
              selectedAudioId={selectedAudioId}
              selectedVideoId={selectedVideoId}
              toggleAudio={() => toggleMedia('audio')}
              toggleVideo={() => toggleMedia('video')}
              participantsCount={participants.length}
              isCall
            />
          </div>
        )}

      </Container>
      <Footer/>
    </Box>
  )
}


export default Call