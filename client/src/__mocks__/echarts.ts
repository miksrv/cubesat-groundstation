const mockChart = {
    setOption: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn()
}
export const init = jest.fn(() => mockChart)
