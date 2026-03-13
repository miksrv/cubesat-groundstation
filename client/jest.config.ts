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
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  moduleDirectories: ['node_modules', 'src'],
}

export default config
