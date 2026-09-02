import React from 'react'

export const Line = () => null
export const Stars = () => null
export const OrbitControls = () => null
/* Renders its children rather than nothing, so a test can assert what the scene
   put into words — in particular that the compass ring carries no letters while
   the magnetometer is uncalibrated. */
export const Text: React.FC<{ children?: React.ReactNode }> = ({ children }) => <span>{children}</span>
export const Billboard: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>
export const Grid = () => null
export const ContactShadows = () => null
export const GizmoHelper = () => null
export const GizmoViewport = () => null
/* Only reached if something renders a gizmo's children, which `GizmoHelper`
   above does not. Present so the import resolves. */
export const useGizmoContext = () => ({ tweenCamera: () => {} })
export const useTexture = (urls: string[] | string) => (Array.isArray(urls) ? urls.map(() => ({})) : {})
