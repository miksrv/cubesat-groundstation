import React from 'react'

export const Line = () => null
export const Stars = () => null
/** Every camera station written through an `OrbitControls` ref, oldest first.
 *  A test that cares about the camera clears this and then reads it back. */
export const orbitControlsMoves: Array<[number, number, number]> = []

/* Forwards a ref, unlike the other stand-ins here, because `Satellite3DScene`'s
   CameraRig recalls the camera by writing through it. Only the shape that write
   touches is mocked; the rest of the real controls has no meaning without a
   WebGL context. */
export const OrbitControls = React.forwardRef<unknown, Record<string, unknown>>((_props, ref) => {
    React.useImperativeHandle(
        ref,
        () => ({
            object: {
                position: {
                    set: (x: number, y: number, z: number) => {
                        orbitControlsMoves.push([x, y, z])
                    }
                }
            },
            target: { set: () => {} },
            update: () => {}
        }),
        []
    )
    return null
})
OrbitControls.displayName = 'OrbitControls'
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
