/**
 * Utility for safe financial calculations.
 * Converts everything to cents/tyins (integers) before calculation.
 */
export class MoneyMath {
    private static PRECISION = 100; // 2 decimal places

    static toInt(amount: number): number {
        return Math.round(amount * this.PRECISION);
    }

    static fromInt(amount: number): number {
        return amount / this.PRECISION;
    }

    static add(a: number, b: number): number {
        return this.fromInt(this.toInt(a) + this.toInt(b));
    }

    static subtract(a: number, b: number): number {
        return this.fromInt(this.toInt(a) - this.toInt(b));
    }

    static multiply(amount: number, factor: number): number {
        // Factor is usually a float (rate, qty), so we multiply then re-round
        return Math.round(amount * factor * this.PRECISION) / this.PRECISION;
    }

    static divide(amount: number, divisor: number): number {
        if (divisor === 0) return 0;
        return Math.round((amount / divisor) * this.PRECISION) / this.PRECISION;
    }

    /**
     * Rounds a number to the nearest integer.
     */
    static round(value: number): number {
        return Math.round(value);
    }
}