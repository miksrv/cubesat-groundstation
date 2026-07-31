import React from 'react'

export const MapContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid='map-container'>{children}</div>
)
export const TileLayer = () => <div data-testid='tile-layer' />
export const Marker = ({ children }: { children?: React.ReactNode }) => <div data-testid='marker'>{children}</div>
export const CircleMarker = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid='circle-marker'>{children}</div>
)
export const Polyline = () => <div data-testid='polyline' />
export const Tooltip = ({ children }: { children: React.ReactNode }) => <div data-testid='tooltip'>{children}</div>
export const useMap = () => ({
    setView: () => {},
    getZoom: () => 3
})
