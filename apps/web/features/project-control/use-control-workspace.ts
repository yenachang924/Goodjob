'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { workspaceRequest } from '@/features/auth/client';
import { localWorkspaceRequest } from './local-storage';
import { validData, type Data } from '@cockpit/shared';
import {
  migrateWorkspace,
  validControlData,
  type ControlData,
} from '@cockpit/shared/control';
import { validWorkspace, type WorkspaceData } from '@cockpit/shared/workspace';
import { MAX_WORKSPACE_BYTES } from '@cockpit/shared/backup';

type ResponseBody = { data?: unknown; revision?: number; error?: string };

function message(error: unknown) {
  return error instanceof Error ? error.message : '저장하지 못했습니다.';
}

export type StorageMode = 'local' | 'cloud';

export function useControlWorkspace(mode: StorageMode = 'cloud') {
  const request = mode === 'local' ? localWorkspaceRequest : workspaceRequest;
  const saving = useRef(false);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await request();
      const body = (await response.json()) as ResponseBody;
      if (
        !response.ok ||
        !validWorkspace(body.data) ||
        !Number.isInteger(body.revision)
      ) {
        throw new Error(
          body.error || '저장된 워크스페이스를 확인할 수 없습니다.',
        );
      }
      setData(body.data);
      setRevision(body.revision as number);
      setConflict(false);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (next: ControlData) => {
      if (saving.current) return false;
      if (!validControlData(next)) {
        setError('입력값과 프로젝트 연결 관계를 확인하세요.');
        return false;
      }
      const body = JSON.stringify({ data: next, revision });
      if (new TextEncoder().encode(body).byteLength > MAX_WORKSPACE_BYTES) {
        setError(
          '저장 용량 1MB를 넘었습니다. 먼저 내보낸 뒤 오래된 기록을 정리하세요.',
        );
        return false;
      }
      saving.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const response = await request({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const result = (await response.json()) as ResponseBody;
        if (response.status === 409) {
          setConflict(true);
          throw new Error(
            '다른 탭에서 변경되었습니다. 입력은 그대로 두었으니 새로고침 후 다시 확인하세요.',
          );
        }
        if (!response.ok || !Number.isInteger(result.revision)) {
          throw new Error(result.error || '저장하지 못했습니다.');
        }
        setData(next);
        setRevision(result.revision as number);
        setNotice(
          mode === 'local' ? '이 브라우저에 저장됨' : '클라우드에 저장됨',
        );
        setConflict(false);
        return true;
      } catch (caught) {
        setError(message(caught));
        return false;
      } finally {
        saving.current = false;
        setBusy(false);
      }
    },
    [request, mode, revision],
  );

  async function upgrade() {
    if (!data || (!validData(data) && !validControlData(data))) return false;
    try {
      return await save(migrateWorkspace(data));
    } catch (caught) {
      setError(message(caught));
      return false;
    }
  }

  async function importData(value: unknown) {
    if (revision !== 0) {
      setError(
        '빈 워크스페이스에만 가져올 수 있습니다. 기존 데이터를 덮어쓰지 않습니다.',
      );
      return false;
    }
    if (!validWorkspace(value)) {
      setError('가져올 파일의 형식이나 연결 관계가 올바르지 않습니다.');
      return false;
    }
    const next = validControlData(value)
      ? value
      : migrateWorkspace(value as Data);
    return save(next);
  }

  return {
    data,
    control: data && validControlData(data) ? data : null,
    legacy: data && !('version' in data) && validData(data) ? data : null,
    loading,
    busy,
    error,
    notice,
    conflict,
    revision,
    load,
    save,
    upgrade,
    importData,
    setError,
  };
}
