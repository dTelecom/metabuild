import * as styles from './Call.module.scss';
import {MutedAudio, MutedVideo, SignalIcon, VideoPlaceholder} from '../../assets';
import {useEffect, useState} from 'react';

export const createBadge = (streamId, name) => {
  const badge = document.createElement('div')
  badge.className = styles.badge

  const signalImage = document.createElement('img')
  signalImage.src = SignalIcon

  const badgeText = document.createElement('p')
  badgeText.id = 'badgeText-' + streamId
  if (name) {
    badgeText.innerText = name
  }

  badge.appendChild(signalImage)
  badge.appendChild(badgeText)
  return badge
}

export const createCallControl = (streamId) => {
  const container = document.createElement('div')
  container.className = styles.controlsBox

  const audio = document.createElement('img')
  audio.src = MutedAudio
  audio.id = 'audio_' + streamId
  audio.style.display = 'none'
  container.appendChild(audio)

  const video = document.createElement('img')
  video.src = MutedVideo
  video.id = 'video_' + streamId
  video.style.display = 'none'
  container.appendChild(video)

  return container
}

export const createVideoElement = ({media: stream, muted, name, hideBadge, style}) => {
  const container = document.createElement('div')
  container.className = styles.streamContainer
  if (style) {
    container.style.width = style.width
    container.style.height = style.height
  }

  const placeholder = document.createElement('img')
  placeholder.src = VideoPlaceholder
  placeholder.className = styles.streamPlaceholder
  container.appendChild(placeholder)

  const remoteVideo = document.createElement('video')
  remoteVideo.id = 'stream_' + stream.id
  remoteVideo.srcObject = stream;
  remoteVideo.autoplay = true;
  remoteVideo.playsInline = true;

  if (muted) {
    remoteVideo.muted = true;
  }
  container.appendChild(remoteVideo)

  if (!hideBadge) {
    const badge = createBadge(stream.id, name)
    container.appendChild(badge)
  }

  const callControls = createCallControl(stream.id)
  container.appendChild(callControls)

  return container
}

export const showMutedBadge = (type, id) => {
  const el = document.getElementById(type + '_' + id)
  if (el) {
    el.style.display = 'initial'
  }

  if (type === 'video') {
    const video = document.getElementById('stream_' + id)
    if (video) {
      video.style.opacity = '0'
    }
  }
}

export const hideMutedBadge = (type, id) => {
  const el = document.getElementById(type + '_' + id)
  if (el) {
    el.style.display = 'none'
  }

  if (type === 'video') {
    const video = document.getElementById('stream_' + id)
    if (video) {
      video.style.opacity = '1'
    }
  }
}

export const useBreakpoints = () => {
  const getDimensions = () => ({
    width: window.innerWidth,
    height: window.innerHeight
  })

  const [dimensions, setDimensions] = useState({width: 0, height: 0})

  useEffect(() => {
    const handleResize = () => {
      setDimensions(getDimensions())
    }
    setDimensions(getDimensions())
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return {
    isMobile: dimensions.width <= 900
  };
};