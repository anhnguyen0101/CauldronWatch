import React from 'react'
import useInit from './entrypoint'

export default function AppBootstrap({children}){
  useInit()
  return children
}
