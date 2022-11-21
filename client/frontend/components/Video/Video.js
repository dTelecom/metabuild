import React, {useEffect, useRef} from 'react';
import {createCallControl, useBreakpoints} from '../../pages/Call/utils';
import * as styles from '../../pages/Call/Call.module.scss';
import {SignalIcon, VideoPlaceholder} from '../../assets';
import {Box} from '@chakra-ui/react';

const Video = ({participant, setParticipants, refs, muted, name}) => {
  const container = useRef()
  const videoElement = useRef();
  const {isMobile} = useBreakpoints();

  useEffect(() => {
    if (videoElement.current) {
      const stream = refs[participant.streamID]

      if (!stream) {
        setParticipants(prev => prev.filter(p => p.streamID !== participant.streamID))
      } else {
        videoElement.current.srcObject = stream

        const placeholder = document.createElement('img')
        placeholder.src = VideoPlaceholder
        placeholder.className = styles.streamPlaceholder
        container.current.appendChild(placeholder)

        const callControls = createCallControl(stream.id)
        container.current.appendChild(callControls)
      }
    }
  }, [])


  return (
    <Box
      p={isMobile ? '4px' : '8px'}
      height={isMobile ? 'calc(100% - 8px)' : 'calc(100% - 16px)'}
    >
      <div
        ref={container}
        className={styles.streamContainer}
      >
        <video
          ref={videoElement}
          id={'stream_' + participant.streamID}
          autoPlay
          muted={muted}
          playsInline
        />

        <div className={styles.badge}>
          <img src={SignalIcon}/>
          <p id={'badgeText-' + participant.streamID}>{decodeURIComponent(name)}</p>
        </div>
      </div>
    </Box>
  )
}

export default Video