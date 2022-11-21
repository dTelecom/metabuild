import React from 'react'
import {
  ArrowDisabledDown,
  ArrowDownIcon,
  EnabledTickIcon,
  MicOffIcon,
  MicOnIcon,
  VideoOffIcon,
  VideoOnIcon
} from '../../assets'
import {Popover, PopoverBody, PopoverContent, PopoverTrigger, useDisclosure} from '@chakra-ui/react'
import * as styles from './SourceControl.module.scss'
import classNames from 'classnames'

const SourceControl = ({isVideo, selected, devices, enabled, onChange, toggleMute, isCall}) => {
  const enabledIcon = isVideo ? VideoOnIcon : MicOnIcon
  const disabledIcon = isVideo ? VideoOffIcon : MicOffIcon
  const enableText = isVideo ? 'Enable Video' : 'Unmute'
  const disableText = isVideo ? 'Disable Video' : 'Mute'
  const icon = isVideo ? VideoOnIcon : MicOnIcon
  const {isOpen, onClose, onOpen} = useDisclosure()

  return (
    <Popover
      closeOnBlur={false}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      placement="top-start"
    >
      <PopoverTrigger>
        <div className={classNames(styles.container, !enabled && styles.containerDisabled, isCall && styles.isCall)}>
          <img
            className={styles.icon}
            src={enabled ? enabledIcon : disabledIcon}
          />
          <img
            className={classNames(isOpen && styles.arrowOpen)}
            src={enabled ? ArrowDownIcon : ArrowDisabledDown}
          />
        </div>
      </PopoverTrigger>

      <PopoverContent style={{outline: 'none'}}>
        <PopoverBody>
          <div className={styles.popOver}>
            {devices?.length > 0 ? devices.map(device => (
              <button
                onClick={() => {
                  onChange(device.deviceId)
                  onClose()
                }}
                key={device.deviceId}
                className={styles.popOverItem}
              >
                <img src={selected === device.deviceId ? EnabledTickIcon : icon}/>
                <p>{device.label}</p>
              </button>
            )) : null}

            <div className={styles.popOverDisable}>
              <button
                onClick={() => {
                  toggleMute()
                  onClose()
                }}
              >{enabled ? disableText : enableText}</button>
            </div>
          </div>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

export default SourceControl