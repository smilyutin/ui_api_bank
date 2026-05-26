export type RegisterFormPayload = {
  identifier?: string;
  email?: string;
  username?: string;
  password: string;
};

export type RegisterFormSubmission = {
  actionPath: string;
  formBody: Record<string, string>;
  headers: Record<string, string>;
};

const EMAIL_KEYS = ['email', 'username', 'user', 'email_address', 'user[email]'];
const PASSWORD_KEYS = ['password', 'pass', 'user[password]'];

const resolveEmailValue = (payload: RegisterFormPayload) =>
  payload.email || payload.identifier || payload.username || '';

const resolveUsernameValue = (payload: RegisterFormPayload) =>
  payload.username || payload.identifier || payload.email || '';

export function buildRegisterFormSubmission(
  html: string,
  payload: RegisterFormPayload,
  baseURL?: string
): RegisterFormSubmission {
  const formMatch = html.match(/<form[^>]*action=["'](?<action>[^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
  let actionPath = '/register';
  let formInner = html;

  if (formMatch?.groups) {
    actionPath = formMatch.groups['action'] || actionPath;
    formInner = formMatch[0];
  }

  const inputs: Record<string, string> = {};
  const withValue = /<input[^>]*name=["'](?<name>[^"']+)["'][^>]*value=["'](?<value>[^"']*)["'][^>]*>/gi;
  const withoutValue = /<input[^>]*name=["'](?<name>[^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = withValue.exec(formInner)) !== null) {
    if (match.groups?.name) {
      inputs[match.groups.name] = match.groups.value || '';
    }
  }
  while ((match = withoutValue.exec(formInner)) !== null) {
    if (match.groups?.name && !(match.groups.name in inputs)) {
      inputs[match.groups.name] = '';
    }
  }

  const formBody: Record<string, string> = {};
  for (const key of Object.keys(inputs)) {
    formBody[key] = inputs[key] || '';
  }

  for (const key of EMAIL_KEYS) {
    if (key in formBody) {
      if (key === 'username' || key === 'user') {
        formBody[key] = resolveUsernameValue(payload);
      } else {
        formBody[key] = resolveEmailValue(payload);
      }
    }
  }
  for (const key of PASSWORD_KEYS) {
    if (key in formBody) {
      formBody[key] = payload.password;
      break;
    }
  }

  try {
    if (actionPath.startsWith('http')) {
      actionPath = new URL(actionPath).pathname;
    }
  } catch {}

  const headers: Record<string, string> = {};
  if (baseURL) {
    try {
      headers['Referer'] = new URL('/register', baseURL).toString();
    } catch {}
    try {
      headers['Origin'] = baseURL;
    } catch {}
  }

  return { actionPath, formBody, headers };
}
