---
title: "프록시 timeout은 본문 읽기 전부터 시작한다"
date: "2026-09-10"
category: integration-issues
module: "learning task proxy"
problem_type: integration_issue
component: service_object
severity: medium
symptoms:
  - "작은 요청 본문을 보내고 전송을 끝내지 않으면 프록시가 계속 대기함"
root_cause: async_timing
resolution_type: code_fix
tags: ["abort-signal", "request-deadline", "stream-cancellation"]
---

# 프록시 timeout은 본문 읽기 전부터 시작한다

## Problem

학습 API 프록시 초기 구현은 요청 본문을 읽은 다음 `fetch`에만 5초 timeout을 걸었다. 본문 수신이 끝나지 않으면 timeout 생성 지점까지 도달하지 못했다. 이 기록은 로컬 작업 트리에서 검증한 수정이며 운영 배포 완료를 뜻하지 않는다.

## Symptoms

수정 전 재현에서 한 바이트를 보내고 닫히지 않는 스트림은 5,200ms 후에도 pending이었다. 바이트 상한보다 작은 본문이라 크기 검사도 이를 종료하지 못했다.

## What Didn't Work

외부 호출에만 timeout을 설정하는 초기 접근은 그 호출 **이전**의 `await`를 보호하지 못했다. 바이트 제한은 크기 문제를 다루지만 전송이 끝나는 시점을 보장하지 않는다.

## Solution

`packages/backend/src/learning-proxy.ts`에서 본문 읽기 전에 다음 signal을 만든다.

```typescript
const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
```

이 signal을 요청 본문 읽기, 외부 `fetch`, 응답 본문 읽기에 공유한다. 단계마다 5초를 새로 주지 않는다. `packages/backend/src/http.ts`의 `boundedText`는 abort 시 reader를 취소하고, 읽기 전후에 abort 상태를 확인한다. `finally`에서 listener와 reader lock을 해제한다. 프록시는 취소 예외를 내부 메시지 없는 503 응답으로 바꾼다.

## Why This Works

처음 본문을 기다릴 때부터 제한 시간이 존재한다. 취소된 읽기를 정상적인 EOF로 처리하지 않도록 읽기 직후에도 abort를 확인한다. 정상 완료와 오류 양쪽에서 자원을 정리한다.

## Prevention

- 프록시 리뷰에서 외부 호출 이전의 `await`도 검사한다.
- 큰 본문과 별개로 **작지만 끝나지 않는 본문**을 테스트한다.
- timeout 응답뿐 아니라 원래 스트림의 cancel 실행도 확인한다.
- 요청 취소와 서버 deadline 모두 검사한다.

회귀 검사는 `packages/backend/tests/http.test.mjs`와 `packages/backend/tests/learning-proxy.test.mjs`에 있다. 후자는 실제 5초 deadline과 명시적 요청 취소를 확인한다. 6.5초짜리 테스트 감시 timer는 hang 검출용이며 제품의 제한 시간과 다르다.

```powershell
node --experimental-strip-types --test packages/backend/tests/http.test.mjs packages/backend/tests/learning-proxy.test.mjs
```

## Related Issues

[백엔드 학습실의 요청 경로와 운영 경계](../../backend-learning.md). 기존 해결 문서 중 중복은 없었으며 별도 원격 이슈 검색은 생략했다.
