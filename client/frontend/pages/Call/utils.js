import * as styles from './Call.module.scss';
import {MutedAudio, MutedVideo, SignalIcon, VideoPlaceholder} from '../../assets';

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

export const createCallControl = (streamId, audio, video) => {
  const container = document.createElement('div')
  container.className = styles.controlsBox

  const audioEl = document.createElement('img')
  audioEl.src = MutedAudio
  audioEl.id = 'audio_' + streamId
  if (audio) {
    audioEl.style.display = 'none'
  }
  container.appendChild(audioEl)

  const videoEl = document.createElement('img')
  videoEl.src = MutedVideo
  videoEl.id = 'video_' + streamId
  if (video) {
    videoEl.style.display = 'none'
  }
  container.appendChild(videoEl)

  return container
}

export const createVideoElement = ({media: stream, muted, name, hideBadge, style, audio = true, video = true}) => {
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

  const callControls = createCallControl(stream.id, audio, video)
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
