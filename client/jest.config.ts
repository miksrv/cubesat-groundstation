import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: {
    '\\.module\\.scss$': 'identity-obj-proxy',
    '\\.scss$': 'identity-obj-proxy',
    '^simple-react-ui-kit$': '<rootDir>/src/__mocks__/simple-react-ui-kit.tsx',
    '^simple-react-ui-kit/dist/.*$': 'identity-obj-proxy',
    '^react-leaflet$': '<rootDir>/src/__mocks__/react-leaflet.tsx',
    '^leaflet$': '<rootDir>/src/__mocks__/leaflet.ts',
    '^leaflet/dist/leaflet.css$': 'identity-obj-proxy',
    '^@react-three/fiber$': '<rootDir>/src/__mocks__/react-three-fiber.tsx',
    '^@react-three/drei$': '<rootDir>/src/__mocks__/react-three-drei.tsx',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/__mocks__/fileMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  moduleDirectories: ['node_modules', 'src'],
}

export default config
