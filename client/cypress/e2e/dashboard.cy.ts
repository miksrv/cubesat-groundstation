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

const mockLatest = {
    id: 1,
    timestamp: '2026-03-12T12:00:00',
    battery: 82.1,
    voltage: 8.14,
    external_power: 1,
    roll: 2.31,
    pitch: -1.24,
    yaw: 5.67,
    imu_temp: 27.4,
    accel_x: 0.01,
    accel_y: -0.02,
    accel_z: 0.0,
    gyro_x: 0.1,
    gyro_y: -0.1,
    gyro_z: 0.0,
    temperature: 23.0,
    humidity: 50.0,
    pressure: 1000.0,
    camera_status: 'READY',
    image_count: 1284,
    image_resolution: '1280x720',
    sensor_status: 'NOMINAL',
    science_mode: false,
    payload_power_watts: 1.23,
    cpu_percent: 34.0,
    ram_percent: 52.0,
    swap_percent: 10.0,
    disk_percent: 41.0,
    uptime_seconds: 187562,
    cpu_temperature: 55.0,
    boot_count: 7,
    obc_temperature: 28.4,
    eps_temperature: 26.7,
    battery_temperature: 21.3,
    payload_temperature: 23.1,
    rssi: -63,
    snr: 17.0,
    uplink_bps: 9600,
    downlink_bps: 9600,
    latency_ms: 127,
    packet_loss_pct: 0.2,
    obc_state: 'NOMINAL',
    latitude: 51.7961,
    longitude: 55.1087,
    altitude: 512.4,
    speed_kms: 7.61
}

const mockOrbit = {
    orbit_type: 'LEO',
    altitude_km: 512.4,
    inclination_deg: 97.45,
    period_min: 94.62,
    raan_deg: 123.54,
    aop_deg: 87.12,
    true_anomaly_deg: 45.32,
    eclipse: false,
    beta_angle_deg: 32.1,
    orbit_number: 245,
    ground_station: { name: 'ORENBURG, RUSSIA', lat: 51.7727, lon: 55.0988 },
    next_pass_seconds: 454
}

describe('CubeSat Ground Station Dashboard', () => {
    beforeEach(() => {
        // Intercept backend API calls so tests are not dependent on a live backend
        cy.intercept('GET', '**/api/cubesat/telemetry/latest', { statusCode: 200, body: mockLatest }).as('getLatest')
        cy.intercept('GET', '**/api/cubesat/telemetry/history*', {
            statusCode: 200,
            body: { count: 1, records: [mockLatest] }
        }).as('getHistory')
        cy.intercept('GET', '**/api/cubesat/orbit', { statusCode: 200, body: mockOrbit }).as('getOrbit')
        cy.intercept('GET', '**/api/cubesat/events*', { statusCode: 200, body: { count: 0, records: [] } }).as(
            'getEvents'
        )
        cy.intercept('GET', '**/api.meteo.miksoft.pro/current', {
            statusCode: 200,
            body: {
                temperature: 16.57,
                feelsLike: 15.5,
                pressure: 1010,
                humidity: 58,
                dewPoint: 8.83,
                visibility: 17165,
                uvIndex: 0,
                solEnergy: 0,
                solRadiation: 0,
                clouds: 2,
                precipitation: 0,
                windSpeed: 1.73,
                windGust: 2.24,
                windDeg: 199,
                weatherId: 800,
                date: '2026-03-12 12:00:00',
                lastUpdated: '2026-03-12T12:00:00+00:00',
                isStale: false
            }
        }).as('getWeather')

        cy.visit('/')
    })

    it('sets the document title', () => {
        cy.title().should('eq', 'CubeSat Ground Station')
    })

    it('shows the mission status bar', () => {
        cy.contains('MISSION STATUS').should('be.visible')
        cy.contains('ORENBURG, RUSSIA').should('be.visible')
    })

    it('renders all subsystem widgets', () => {
        cy.contains('Power System').should('be.visible')
        cy.contains('Thermal System').should('be.visible')
        cy.contains('ADCS').should('be.visible')
        cy.contains('OBC System').should('be.visible')
        cy.contains('Payload').should('be.visible')
    })

    it('renders the 3D satellite view, orbit globe and ground station link map', () => {
        cy.contains('3D Satellite View').should('be.visible')
        cy.contains('Orbit & Ground Track').should('be.visible')
        cy.contains('Ground Station Link').should('be.visible')
    })

    it('renders mission events, telemetry graphs and the MQTT bus monitor', () => {
        cy.contains('Mission Events').should('be.visible')
        cy.contains('Telemetry Graphs').should('be.visible')
        cy.contains('Live Telemetry Stream').should('be.visible')
        cy.contains('MQTT Bus Monitor').should('be.visible')
    })

    it('sends a quick command and shows the confirmation message', () => {
        cy.intercept('POST', '**/api/cubesat/commands', {
            statusCode: 200,
            body: { status: 'ok', message: 'Science mode enabled', event_id: 1 }
        }).as('sendCommand')

        cy.contains('Quick Commands').should('be.visible')
        cy.contains('button', 'ENABLE SCIENCE MODE').click()
        cy.wait('@sendCommand')
        cy.contains('Science mode enabled').should('be.visible')
    })

    it('runs a "status" command in the Mission Console', () => {
        cy.contains('Mission Console').should('be.visible')
        cy.get('input[placeholder="Type a command…"]').type('status{enter}')
        cy.contains('Satellite Status:').should('be.visible')
    })

    it('displays an error banner when the API is unreachable', () => {
        cy.intercept('GET', '**/api/cubesat/telemetry/latest', { forceNetworkError: true }).as('getLatestError')

        cy.visit('/')
        cy.contains('Unable to reach API').should('be.visible')
    })
})
