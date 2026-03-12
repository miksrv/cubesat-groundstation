import React from 'react'
import { Provider } from 'react-redux'

import type { RenderOptions } from '@testing-library/react'
import { render } from '@testing-library/react'

import { store } from './app/store'

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>{children}</Provider>
)

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    render(ui, { wrapper: AllProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
