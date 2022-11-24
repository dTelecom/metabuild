import {useCallback, useMemo, useState} from 'react';
import {desktopConstraints, mobileConstraints} from '../pages/Call/const';
import {useBreakpoints} from './useBreakpoints';

export const useMediaConstraints = (initialConstraints, audioEnabled = true, videoEnabled = true) => {
  const {isMobile} = useBreakpoints()
  const videoConstraints = useMemo(() => isMobile ? mobileConstraints : desktopConstraints, [isMobile])
  const defaultConstraints = useMemo(() => ({audio: true, video: videoConstraints}), [])
  const [constraintsState, setConstraintsState] = useState(initialConstraints || defaultConstraints)
  const [enabledState, setEnabledState] = useState({
    audio: audioEnabled,
    video: videoEnabled,
  })

  const onDeviceChange = (type, deviceId) => {
    setEnabledState(prev => ({...prev, [type]: true}))

    const obj = deviceId === true ? {} : {deviceId: {exact: deviceId}}
    const typeConstraint = {
      ...(constraintsState[type] || {}),
      ...obj
    }

    const newState = getConstraints({
      ...constraintsState,
      [type]: typeConstraint
    }, {...enabledState, [type]: true})

    setConstraintsState(prev => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        ...obj
      }
    }))

    return newState
  }

  const onMediaToggle = (type) => {
    setEnabledState(prev => ({...prev, [type]: !prev[type]}))
  }

  const getConstraints = useCallback((state, enabled) => {
    return {
      audio: enabled.audio ? state.audio : false,
      video: enabled.video ? state.video : false
    }
  }, [])

  const constraints = useMemo(() => getConstraints(constraintsState, enabledState), [enabledState, constraintsState])

  return {
    onMediaToggle,
    onDeviceChange,
    selectedVideoId: constraintsState.video?.deviceId?.exact,
    selectedAudioId: constraintsState.audio?.deviceId?.exact,
    constraints,
    audioEnabled: enabledState.audio,
    videoEnabled: enabledState.video,
    defaultConstraints,
    constraintsState,
  }
}