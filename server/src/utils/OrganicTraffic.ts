/**
 * OrganicTraffic Utility
 * Provides entropy and natural patterns for data simulations.
 */
export class OrganicTraffic {
    /**
     * Adds random variation (jitter) to a number.
     * @param value The base value
     * @param variance Percentage of variance (0.1 = 10%)
     */
    static jitter(value: number, variance: number = 0.1): number {
        const offset = value * variance;
        return value + (Math.random() * offset * 2 - offset);
    }

    /**
     * Pick a scenario from an array of weighted objects.
     * @param scenarios Array of { type: string, weight: number, ... }
     * @param drift Optional: adds random drift to weights each time this is called
     */
    static weightedPick<T extends { weight: number }>(scenarios: T[], drift: number = 0): T {
        const modifiedScenarios = scenarios.map(s => ({
            ...s,
            tempWeight: Math.max(0.01, s.weight + (Math.random() * drift * 2 - drift))
        }));

        const totalWeight = modifiedScenarios.reduce((sum, s) => sum + s.tempWeight, 0);
        const random = Math.random() * totalWeight;

        let cumulative = 0;
        for (const s of modifiedScenarios) {
            cumulative += s.tempWeight;
            if (random < cumulative) return s;
        }
        return scenarios[0];
    }

    /**
     * Returns a delay in ms that simulates "bursty" human arrival.
     * Some arrive fast, some arrive slow.
     */
    static naturalDelay(baseMs: number): number {
        const factor = Math.random();
        if (factor > 0.8) return baseMs * 5; // Long pause
        if (factor < 0.2) return baseMs * 0.2; // Burst arrival
        return this.jitter(baseMs, 0.4);
    }

    /**
     * Generates a random dwell time within a range, with jitter.
     */
    static dwell(range: [number, number]): number {
        const base = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        return Math.floor(this.jitter(base, 0.15));
    }
}
