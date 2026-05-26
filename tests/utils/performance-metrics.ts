import fs from 'fs/promises'
import path from 'path'

interface ValidationMetric {
    timestamp: string
    endpoint: string
    schemaName: string
    success: boolean
    duration: number
    errorType?: string
    schemaVersion?: string
}

interface DailyMetrics {
    date: string
    totalValidations: number
    successfulValidations: number
    failedValidations: number
    accuracy: number
    avgDuration: number
    errorTypes: Record<string, number>
    affectedEndpoints: string[]
}

const METRICS_PATH = './metrics'
const DAILY_METRICS_PATH = path.join(METRICS_PATH, 'daily')
const TRENDS_PATH = path.join(METRICS_PATH, 'trends.json')

export class PerformanceMetrics {
    private static metrics: ValidationMetric[] = []

    static async trackValidation(
        endpoint: string,
        schemaName: string,
        success: boolean,
        duration: number,
        errorType?: string
    ) {
        const metric: ValidationMetric = {
            timestamp: new Date().toISOString(),
            endpoint,
            schemaName,
            success,
            duration,
            errorType,
            schemaVersion: '1.0.0'
        }

        this.metrics.push(metric)
    }

    static async saveMetrics() {
        if (this.metrics.length === 0) return

        const today = new Date().toISOString().split('T')[0]
        const dailyFile = path.join(DAILY_METRICS_PATH, `${today}.json`)

        await fs.mkdir(DAILY_METRICS_PATH, { recursive: true })

        const existingMetrics = await this.loadDailyMetrics(dailyFile)
        const allMetrics = [...existingMetrics, ...this.metrics]

        await fs.writeFile(dailyFile, JSON.stringify(allMetrics, null, 2))

        await this.updateDailySummary(today, allMetrics)
        await this.updateTrends()

        this.metrics = []
    }

    private static async loadDailyMetrics(filePath: string): Promise<ValidationMetric[]> {
        try {
            const content = await fs.readFile(filePath, 'utf-8')
            return JSON.parse(content)
        } catch {
            return []
        }
    }

    private static async updateDailySummary(date: string, metrics: ValidationMetric[]) {
        const successful = metrics.filter(m => m.success).length
        const failed = metrics.filter(m => !m.success).length
        const total = metrics.length

        const errorTypes: Record<string, number> = {}
        const affectedEndpoints = new Set<string>()

        metrics.forEach(m => {
            if (!m.success && m.errorType) {
                errorTypes[m.errorType] = (errorTypes[m.errorType] || 0) + 1
                affectedEndpoints.add(m.endpoint)
            }
        })

        const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / total

        const summary: DailyMetrics = {
            date,
            totalValidations: total,
            successfulValidations: successful,
            failedValidations: failed,
            accuracy: (successful / total) * 100,
            avgDuration: Math.round(avgDuration),
            errorTypes,
            affectedEndpoints: Array.from(affectedEndpoints)
        }

        const summaryFile = path.join(DAILY_METRICS_PATH, `${date}-summary.json`)
        await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2))

        await this.checkSLAThresholds(summary)
    }

    private static async checkSLAThresholds(summary: DailyMetrics) {
        const thresholds = {
            accuracy: { target: 100, warning: 98, critical: 95 },
            avgDuration: { target: 1000, warning: 2000, critical: 5000 }
        }

        const alerts: string[] = []

        if (summary.accuracy < thresholds.accuracy.critical) {
            alerts.push(`CRITICAL: Accuracy at ${summary.accuracy.toFixed(2)}% (threshold: ${thresholds.accuracy.critical}%)`)
        } else if (summary.accuracy < thresholds.accuracy.warning) {
            alerts.push(`WARNING: Accuracy at ${summary.accuracy.toFixed(2)}% (threshold: ${thresholds.accuracy.warning}%)`)
        }

        if (summary.avgDuration > thresholds.avgDuration.critical) {
            alerts.push(`CRITICAL: Avg duration ${summary.avgDuration}ms (threshold: ${thresholds.avgDuration.critical}ms)`)
        } else if (summary.avgDuration > thresholds.avgDuration.warning) {
            alerts.push(` WARNING: Avg duration ${summary.avgDuration}ms (threshold: ${thresholds.avgDuration.warning}ms)`)
        }

        if (alerts.length > 0) {
            console.log('\n' + '='.repeat(80))
            console.log('PERFORMANCE ALERTS:')
            alerts.forEach(alert => console.log(alert))
            console.log('='.repeat(80) + '\n')

            const alertsFile = path.join(METRICS_PATH, 'alerts.log')
            const alertEntry = `[${summary.date}]\n${alerts.join('\n')}\n\n`
            await fs.appendFile(alertsFile, alertEntry)
        }
    }

    private static async updateTrends() {
        const files = await fs.readdir(DAILY_METRICS_PATH)
        const summaryFiles = files.filter(f => f.endsWith('-summary.json')).sort().slice(-30)

        const trends = await Promise.all(
            summaryFiles.map(async file => {
                const content = await fs.readFile(path.join(DAILY_METRICS_PATH, file), 'utf-8')
                return JSON.parse(content) as DailyMetrics
            })
        )

        const trendAnalysis = {
            lastUpdated: new Date().toISOString(),
            period: '30 days',
            trends,
            analysis: this.analyzeTrends(trends)
        }

        await fs.writeFile(TRENDS_PATH, JSON.stringify(trendAnalysis, null, 2))
    }

    private static analyzeTrends(trends: DailyMetrics[]) {
        if (trends.length === 0) return {}

        const recent = trends.slice(-7)
        const avgAccuracy = recent.reduce((sum, t) => sum + t.accuracy, 0) / recent.length
        const avgDuration = recent.reduce((sum, t) => sum + t.avgDuration, 0) / recent.length

        const accuracyTrend = trends.length >= 2
            ? recent[recent.length - 1].accuracy - recent[0].accuracy
            : 0

        const durationTrend = trends.length >= 2
            ? recent[recent.length - 1].avgDuration - recent[0].avgDuration
            : 0

        return {
            last7Days: {
                avgAccuracy: avgAccuracy.toFixed(2) + '%',
                avgDuration: Math.round(avgDuration) + 'ms',
                accuracyTrend: accuracyTrend > 0 ? `↑ ${accuracyTrend.toFixed(2)}%` : `↓ ${Math.abs(accuracyTrend).toFixed(2)}%`,
                durationTrend: durationTrend > 0 ? `↑ ${Math.round(durationTrend)}ms` : `↓ ${Math.abs(Math.round(durationTrend))}ms`
            },
            status: this.getHealthStatus(avgAccuracy, avgDuration)
        }
    }

    private static getHealthStatus(accuracy: number, duration: number): string {
        if (accuracy >= 100 && duration < 1000) return 'Excellent'
        if (accuracy >= 98 && duration < 2000) return 'Good'
        if (accuracy >= 95 && duration < 5000) return 'Fair'
        return 'Needs Attention'
    }

    static async generateReport() {
        try {
            const trendsContent = await fs.readFile(TRENDS_PATH, 'utf-8')
            const trends = JSON.parse(trendsContent)

            console.log('\n' + '='.repeat(80))
            console.log(' PERFORMANCE METRICS REPORT')
            console.log('='.repeat(80))
            console.log(`Period: ${trends.period}`)
            console.log(`Last Updated: ${new Date(trends.lastUpdated).toLocaleString()}`)
            console.log('\nRecent Performance (Last 7 Days):')
            console.log(`  Average Accuracy: ${trends.analysis.last7Days.avgAccuracy}`)
            console.log(`  Average Duration: ${trends.analysis.last7Days.avgDuration}`)
            console.log(`  Accuracy Trend: ${trends.analysis.last7Days.accuracyTrend}`)
            console.log(`  Duration Trend: ${trends.analysis.last7Days.durationTrend}`)
            console.log(`\nOverall Status: ${trends.analysis.status}`)
            console.log('='.repeat(80) + '\n')
        } catch {
            console.log('No performance data available yet.')
        }
    }
}
