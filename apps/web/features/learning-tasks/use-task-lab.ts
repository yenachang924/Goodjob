'use client';

import { useState } from 'react';
import {
  basicAuthorization,
  loadTasks,
  saveTask,
  type LearningTask,
  type TaskInput,
  type TaskPage,
} from './client';

const emptyPage = (): TaskPage => ({ tasks: [], total: 0, page: 0, limit: 20 });

export function useTaskLab() {
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [auth, setAuth] = useState(''),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [result, setResult] = useState<TaskPage>(emptyPage),
    [editing, setEditing] = useState<LearningTask>();
  const [formKey, setFormKey] = useState(0);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const authorization = basicAuthorization(username, password);
      setResult(await loadTasks(authorization));
      setAuth(authorization);
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '연결에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function refresh(page = result.page) {
    setBusy(true);
    setError('');
    try {
      setResult(await loadTasks(auth, page));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '새로고침에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(
    input: TaskInput,
    existing?: LearningTask,
    source: 'editor' | 'list' = 'editor',
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveTask(auth, input, existing);
      if (source === 'editor') {
        setEditing(undefined);
        setFormKey((key) => key + 1);
      }
      setNotice('저장했습니다.');
      setResult(await loadTasks(auth, result.page));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장에 실패했습니다.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    setAuth('');
    setPassword('');
    setResult(emptyPage());
    setEditing(undefined);
    setError('');
    setNotice('');
  }

  return {
    username,
    password,
    auth,
    busy,
    error,
    notice,
    result,
    editing,
    formKey,
    setUsername,
    setPassword,
    setEditing,
    connect,
    refresh,
    save,
    disconnect,
  };
}
