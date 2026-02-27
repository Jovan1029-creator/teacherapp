// src\api\analytics.ts
import type { ScoreDistributionBucket, ScoreTrendPoint, TopicPerformance } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId } from './helpers'

export async function getScoreTrend(): Promise<ScoreTrendPoint[]> {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('attempts')
    .select('total_score, test:tests!inner(id,title,date,school_id)')
    .eq('test.school_id', schoolId)

  if (error) throw new Error(error.message)

  const groups = new Map<string, { title: string; date: string | null; values: number[] }>()
  for (const row of data ?? []) {
    const test = Array.isArray(row.test) ? row.test[0] : row.test
    if (!test) continue
    const existing = groups.get(test.id) ?? { title: test.title, date: test.date, values: [] as number[] }
    existing.values.push(row.total_score ?? 0)
    groups.set(test.id, existing)
  }

  return Array.from(groups.entries())
    .map(([testId, value]) => ({
      test_id: testId,
      test_title: value.title,
      date: value.date,
      average_score:
        value.values.length > 0
          ? Number((value.values.reduce((sum, current) => sum + current, 0) / value.values.length).toFixed(2))
          : 0,
    }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
}

export async function getScoreDistribution(): Promise<ScoreDistributionBucket[]> {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('attempts')
    .select('total_score, test:tests!inner(school_id)')
    .eq('test.school_id', schoolId)

  if (error) throw new Error(error.message)

  const buckets: ScoreDistributionBucket[] = [
    { bucket: '0-19', count: 0 },
    { bucket: '20-39', count: 0 },
    { bucket: '40-59', count: 0 },
    { bucket: '60-79', count: 0 },
    { bucket: '80-100', count: 0 },
  ]

  for (const row of data ?? []) {
    const score = Number(row.total_score ?? 0)
    if (score < 20) buckets[0].count += 1
    else if (score < 40) buckets[1].count += 1
    else if (score < 60) buckets[2].count += 1
    else if (score < 80) buckets[3].count += 1
    else buckets[4].count += 1
  }

  return buckets
}

export async function getWeakestTopics(limit = 5): Promise<TopicPerformance[]> {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('attempt_answers')
    .select('is_correct, question:questions!inner(topic_id, topic:topics(id,title), school_id)')
    .eq('question.school_id', schoolId)

  if (error) throw new Error(error.message)

  const topicMap = new Map<string, TopicPerformance>()

  for (const row of data ?? []) {
    const question = Array.isArray(row.question) ? row.question[0] : row.question
    const topic = question?.topic
    const topicRecord = Array.isArray(topic) ? topic[0] : topic
    const topicId = question?.topic_id || topicRecord?.id
    if (!topicId) continue

    const existing = topicMap.get(topicId) ?? {
      topic_id: topicId,
      topic_title: topicRecord?.title ?? 'Untitled topic',
      correct_count: 0,
      total_count: 0,
      pct_correct: 0,
    }

    existing.total_count += 1
    if (row.is_correct) existing.correct_count += 1

    topicMap.set(topicId, existing)
  }

  return Array.from(topicMap.values())
    .map((topic) => ({
      ...topic,
      pct_correct: topic.total_count
        ? Number(((topic.correct_count / topic.total_count) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => a.pct_correct - b.pct_correct)
    .slice(0, limit)
}
