const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const koreaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });

export function durationMinutes(hours: string, minutes: string): number {
  if (![hours, minutes].every((part) => /^\d*$/.test(part)))
    throw new Error('시간과 분은 0 이상의 정수로 입력하세요.');
  const h = Number(hours);
  const m = Number(minutes);
  const total = h * 60 + m;
  if (h > 24 || m > 59 || total <= 0 || total > 1440)
    throw new Error(
      '시간은 0~24, 분은 0~59로 입력하세요. 합계는 1분~24시간이어야 합니다.',
    );
  return total;
}

export function durationRange(date: string, minutes: number, now: number) {
  const dayStart = Date.parse(`${date}T00:00:00+09:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(dayStart) ||
    koreaDate.format(dayStart) !== date
  )
    throw new Error('기록 날짜를 확인하세요.');
  if (date > koreaDate.format(now))
    throw new Error('미래 시간은 기록할 수 없습니다.');
  const endedAt = date === koreaDate.format(now) ? now : dayStart + DAY_MS;
  return { startedAt: endedAt - minutes * MINUTE_MS, endedAt };
}

export function trackedDuration(seconds: number): string {
  if (seconds > 0 && seconds < 60) return '1분 미만';
  const total = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}분`;
  return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

export function editedDurationRange(
  original: { startedAt: number; endedAt: number } | null,
  date: string,
  hours: string,
  minutes: string,
  durationChanged: boolean,
  now: number,
) {
  if (original && date === koreaDate.format(original.startedAt)) {
    if (!durationChanged) return { ...original };
    return {
      startedAt: original.endedAt - durationMinutes(hours, minutes) * MINUTE_MS,
      endedAt: original.endedAt,
    };
  }
  return durationRange(date, durationMinutes(hours, minutes), now);
}
