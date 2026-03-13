/**
 * Cypress E2E Tests - CubeSat Ground Station Dashboard
 *
 * NOTE: Cypress is not currently installed as a project dependency.
 * These tests are stubs ready to run once Cypress is installed and
 * a dev server is available.
 *
 * To install Cypress:
 *   npm install --save-dev cypress
 *
 * To run headlessly (requires dev server on localhost:3000):
 *   npx cypress run --headless
 *
 * To open interactive runner:
 *   npx cypress open
 *
 * The dev server must be running before executing these tests:
 *   npm run dev   (starts rsbuild dev server, typically on port 3000)
 */

describe('CubeSat Ground Station Dashboard', () => {
    beforeEach(() => {
        // Intercept backend API calls so tests are not dependent on a live backend
        cy.intercept('GET', '**/api/cubesat/telemetry/latest', {
            statusCode: 200,
            body: {
                id: 1,
                timestamp: '2026-03-12T12:00:00',
                battery: 95.5,
                voltage: 8.2,
                current: 0.45,
                temperature_eps: 22.0,
                gyro_x: 0.01,
                gyro_y: -0.02,
                gyro_z: 0.005,
                accel_x: 0.0,
                accel_y: 0.0,
                accel_z: 9.8,
                latitude: 51.5074,
                longitude: -0.1278,
                altitude: 550.0,
                cpu_usage: 34.0,
                memory_usage: 62.0,
                temperature_obc: 23.5,
                uptime: 86400,
                payload_sensor_1: 0.12,
                payload_sensor_2: 0.08
            }
        }).as('getLatest')

        cy.intercept('GET', '**/api/cubesat/telemetry/history*', {
            statusCode: 200,
            body: []
        }).as('getHistory')

        cy.visit('/')
    })

    it('displays the application header with correct title', () => {
        cy.contains('CubeSat Ground Station').should('be.visible')
    })

    it('renders the EPS panel', () => {
        cy.contains('EPS').should('be.visible')
    })

    it('renders the ADCS panel', () => {
        cy.contains('ADCS').should('be.visible')
    })

    it('renders the GPS panel', () => {
        cy.contains('GPS').should('be.visible')
    })

    it('renders the System panel', () => {
        cy.contains('System').should('be.visible')
    })

    it('renders the Telemetry Timeline panel', () => {
        cy.contains('Telemetry Timeline').should('be.visible')
    })

    it('shows all key dashboard panels on load', () => {
        cy.contains('EPS').should('be.visible')
        cy.contains('ADCS').should('be.visible')
        cy.contains('GPS').should('be.visible')
        cy.contains('System').should('be.visible')
        cy.contains('Telemetry Timeline').should('be.visible')
        cy.contains('CubeSat Ground Station').should('be.visible')
    })

    it('displays an error banner when the API is unreachable', () => {
        cy.intercept('GET', '**/api/cubesat/telemetry/latest', {
            forceNetworkError: true
        }).as('getLatestError')

        cy.visit('/')
        cy.contains('Unable to reach API').should('be.visible')
    })
})
