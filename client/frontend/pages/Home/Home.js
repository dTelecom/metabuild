import React, {useCallback, useEffect, useRef, useState} from 'react'
import {Header} from '../../components/Header/Header';
import {Button} from '../../components/Button/Button';
import * as styles from './Home.module.scss'
import {observer} from 'mobx-react';
import {useNavigate, useParams} from 'react-router-dom';
import {Container} from '../../components/Container/Container';
import {Box, Flex} from '@chakra-ui/react';
import Input from '../../components/Input/Input';
import VideoControls from '../../components/VideoControls/VideoControls';
import Footer from '../../components/Footer/Footer';
import axios from 'axios';
import ParticipantsBadge from '../../components/ParticipantsBadge/ParticipantsBadge';
import {createVideoElement, hideMutedBadge, showMutedBadge} from '../Call/utils';
import {useMediaConstraints} from '../../hooks/useMediaConstraints';

const Home = ({isJoin}) => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [hasVideo, setHasVideo] = useState(false)
  const [devices, setDevices] = useState([])
  const [participants, setParticipants] = useState()
  const {
    constraints,
    onDeviceChange,
    onMediaToggle,
    audioEnabled,
    videoEnabled,
    selectedAudioId,
    selectedVideoId,
    constraintsState,
  } = useMediaConstraints();
  const {sid} = useParams();
  const videoContainer = useRef()
  const localVideo = useRef()

  useEffect(() => {
    if (isJoin) {
      void loadParticipants()
    }

    void loadMedia(constraints)
  }, [])

  const loadParticipants = async () => {
    axios.get('https://nmeet.org/api/participants?sid=' + sid).then((response) => {
      setParticipants(response.data);
    }).catch(console.error);
  }

  const loadMedia = async (config) => {
    console.log('loadMedia', config);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(config);
      void loadDevices()

      if (!selectedVideoId && !selectedAudioId) {
        // set initial devices
        stream.getTracks().forEach(track => {
            const deviceId = track.getSettings().deviceId
            onDeviceChange(track.kind, deviceId)
          }
        )
      }

      if (!videoContainer.current) {
        setTimeout(() => loadMedia(config), 200)
      } else {
        localVideo.current = stream
        const video = createVideoElement({
          media: stream,
          muted: true,
          hideBadge: true,
          style: {width: '100%', height: '100%'},
          audio: !!config.audio,
          video: !!config.video,
        })

        videoContainer.current.innerHTML = ''
        videoContainer.current.appendChild(video)
        setHasVideo(true)
      }
    } catch
      (err) {
      console.error(err)
    }
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

  const onDeviceSelect = useCallback((type, deviceId) => {
    const constraints = onDeviceChange(type, deviceId)
    void loadMedia(constraints)
  }, [constraints])

  function toggleAudio() {
    if (localVideo.current) {
      const track = localVideo.current.getAudioTracks()[0]
      if (!track) {
        onDeviceSelect('audio', true)
        return
      }
      track.enabled = !audioEnabled;
      if (!audioEnabled) {
        hideMutedBadge('audio', localVideo.current.id)
      } else {
        showMutedBadge('audio', localVideo.current.id)
      }
      onMediaToggle('audio')
    }
  }

  function toggleVideo() {
    if (localVideo.current) {
      const prevState = videoEnabled
      const track = localVideo.current.getVideoTracks()[0]
      if (!track) {
        onDeviceSelect('video', true)
        return
      }
      track.enabled = !prevState;
      if (!prevState) {
        hideMutedBadge('video', localVideo.current.id)
      } else {
        showMutedBadge('video', localVideo.current.id)
      }
      onMediaToggle('video')
    }
  }

  const disabled = !name || !hasVideo;

  if (isJoin && participants === undefined) return null;

  const title = isJoin ? decodeURIComponent(participants[0]?.name) + '\ninvites you' : 'Try one click\nmeeting'
  const buttonText = isJoin ? 'Join meeting' : 'Create a meeting'

  return (
    <>
      <Header centered/>

      <Container>
        <Flex
          width={'100%'}
          className={styles.container}
        >
          <div className={styles.videoContainer}>
            <div ref={videoContainer}/>

            <div className={styles.videoControls}>
              <VideoControls
                devices={devices}
                videoEnabled={videoEnabled}
                audioEnabled={audioEnabled}
                onDeviceChange={onDeviceSelect}
                toggleAudio={toggleAudio}
                toggleVideo={toggleVideo}
                selectedVideoId={selectedVideoId}
                selectedAudioId={selectedAudioId}
              />
            </div>
          </div>

          <Flex>
            <Flex
              className={styles.joinContainer}
            >
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.label}>Enter your name:</p>

              <Input
                value={name}
                onChange={setName}
                placeholder={'John'}
              />

              <Box
                mt={'16px'}
                width={'100%'}
                boxSizing={'border-box'}
                className={styles.buttonContainer}
              >
                <Button
                  onClick={() => navigate(isJoin ? '/call/' + sid : '/call', {
                    state: {
                      name,
                      callState: constraintsState,
                      audioEnabled,
                      videoEnabled
                    }
                  })}
                  text={buttonText}
                  disabled={disabled}
                />
              </Box>

              {isJoin ? (
                <div className={styles.inviteText}>
                  <span>At the meeting</span><ParticipantsBadge count={participants?.length}/>participants
                </div>
              ) : (
                <p className={styles.text}>
                  {'Meeting time limit is 30 minutes. \n' +
                    'The number of participants is up to 10 people.'}
                </p>
              )}
            </Flex>
          </Flex>
        </Flex>
      </Container>

      <Footer/>
    </>
  )
}

export default observer(Home)