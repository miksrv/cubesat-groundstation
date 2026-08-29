import { useWeather } from '../../features/weather/useWeather'
import { render, screen } from '../../test-utils'

import WeatherWidget from './WeatherWidget'

import '@testing-library/jest-dom'

jest.mock('../../features/weather/useWeather', () => ({
    useWeather: jest.fn()
}))

const mockUseWeather = useWeather as jest.Mock

describe('WeatherWidget', () => {
    it('renders temperature and condition', () => {
        mockUseWeather.mockReturnValue({
            data: {
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
                date: '2026-07-30 23:45:05',
                lastUpdated: '2026-07-30T23:45:05+00:00',
                isStale: false
            },
            isLoading: false,
            isUnreachable: false
        })
        render(<WeatherWidget />)
        expect(screen.getByText('17°C')).toBeInTheDocument()
        expect(screen.getByText('Clear sky')).toBeInTheDocument()
        expect(screen.getByText(/1\.7 m\/s S/)).toBeInTheDocument()
    })

    it('shows a fallback message when the weather service errors', () => {
        mockUseWeather.mockReturnValue({ data: null, isLoading: false, isUnreachable: true })
        render(<WeatherWidget />)
        expect(screen.getByText('No internet on this profile — weather unavailable')).toBeInTheDocument()
    })

    it('shows skeleton while loading with no data', () => {
        mockUseWeather.mockReturnValue({ data: null, isLoading: true, isUnreachable: false })
        const { container } = render(<WeatherWidget />)
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
