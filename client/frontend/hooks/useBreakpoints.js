import {useEffect, useState} from 'react';

export const useBreakpoints = () => {
  const getDimensions = () => ({
    width: window.innerWidth,
    height: window.innerHeight
  })

  const [dimensions, setDimensions] = useState({width: window.innerWidth, height: window.innerHeight})

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