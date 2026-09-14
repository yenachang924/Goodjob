import 'server-only';
import { learningProxy } from './learning-proxy.ts';
export const learningEndpoint = (request: Request, id?: string) =>
  learningProxy(
    request,
    process.env.GOODJOB_API_URL,
    id,
    process.env.GOODJOB_WEB_ORIGIN,
  );
