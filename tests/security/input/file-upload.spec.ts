import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { uploadProfilePicture } from '../../../fixtures/api/profile.helpers';

/**
 * Input - File upload validation
 *
 * app.py's upload_profile_picture route (POST /upload_profile_picture)
 * comments claim four vulnerabilities: no file type validation, no file
 * size check, no content-type validation, and path traversal via the
 * filename. Each is checked directly against the live app rather than
 * trusted from the comments — one of the four turned out to be wrong:
 *
 * - Path traversal is NOT exploitable: the route calls Werkzeug's
 *   secure_filename() before saving, which strips '../' and flattens the
 *   name (confirmed by uploading `../../../../tmp/x.png` and observing the
 *   stored path has no directory traversal at all).
 * - File type IS unvalidated, and it's worse than "wrong extension
 *   accepted": an uploaded .html file is served back from
 *   /static/uploads/<name> with Content-Type: text/html and
 *   Content-Disposition: inline, so a browser executes it — a third,
 *   independent stored-XSS vector alongside tests/api/xss.spec.ts and
 *   tests/ui/specs/xss.spec.ts.
 * - No file size limit — consistent with tests/security/abuse/payload-size.spec.ts.
 */
test.describe('Input - File upload validation', () => {
  test('an uploaded .html file should not be served back with an executable content-type', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'file-upload-type');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { filePath, uploadStatus } = await test.step('Upload an HTML file as a profile picture', async () => {
      const payload = Buffer.from('<script>window.__uploadedHtmlExecuted=true</script>');
      const upload = await uploadProfilePicture(api, session.token, {
        filename: 'evil.html',
        mimeType: 'text/html',
        buffer: payload
      });
      const uploadBody = await upload.json().catch(() => null);
      const filePath: string | undefined = uploadBody?.file_path;
      return { filePath, uploadStatus: upload.status() };
    });

    if (uploadStatus !== 200 || !filePath) {
      reporter.reportPass('The .html upload was rejected outright (non-200 or no file_path returned).', 'API8:2023 - Security Misconfiguration');
      await api.dispose();
      return;
    }

    const { contentType, disposition } = await test.step('Fetch the served file', async () => {
      const served = await api.get(`/${filePath}`);
      const contentType = served.headers()['content-type'] || '';
      const disposition = served.headers()['content-disposition'] || '';
      await api.dispose();

      testInfo.attach('file-upload-type-probe', {
        body: JSON.stringify({ filePath, servedStatus: served.status(), contentType, disposition }, null, 2),
        contentType: 'application/json'
      });
      return { contentType, disposition };
    });

    await test.step('Verify it is not served with an executable content-type', async () => {
    const executesAsHtml = contentType.includes('text/html') && !disposition.toLowerCase().includes('attachment');

      if (executesAsHtml) {
        reporter.reportVulnerability(
          'API8_SECURITY_MISCONFIGURATION',
          { endpoint: 'POST /upload_profile_picture', servedPath: filePath, contentType, disposition },
          [
            'Restrict uploaded file extensions/content-types to an image allowlist (png/jpg/jpeg/gif/webp) and reject everything else server-side.',
            'Serve uploaded files with Content-Disposition: attachment and a fixed Content-Type (or re-encode images server-side) so the browser never executes them.',
            'Serve /static/uploads from a separate origin/subdomain with no cookies, so even an executed payload can\'t reach the app\'s session.'
          ]
        );
      } else {
        reporter.reportPass('Uploaded .html file was not served with an executable content-type.', 'API8:2023 - Security Misconfiguration');
      }
    });
  });

  test('a path-traversal filename should not escape the uploads directory', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'file-upload-traversal');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const filePath = await test.step('Upload a file with a path-traversal filename', async () => {
      const upload = await uploadProfilePicture(api, session.token, {
        filename: '../../../../tmp/traversal-probe.png'
      });
      const body = await upload.json().catch(() => null);
      await api.dispose();

      const filePath: string | undefined = body?.file_path;
      testInfo.attach('file-upload-traversal-probe', { body: JSON.stringify({ status: upload.status(), filePath }, null, 2), contentType: 'application/json' });
      return filePath;
    });

    await test.step('Verify it did not escape the uploads directory', async () => {
    const escapedUploadsDir = !!filePath && (filePath.includes('../') || !filePath.startsWith('static/uploads/'));

    if (escapedUploadsDir) {
      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        { endpoint: 'POST /upload_profile_picture', filePath },
        ['Reject or fully normalize filenames outside the intended uploads directory server-side, independent of secure_filename().']
      );
      } else {
        reporter.reportPass(`Path-traversal filename was neutralized (stored as: ${filePath}).`, 'API8:2023 - Security Misconfiguration');
      }
    });
  });

  test('an oversized file should not be accepted with no size limit enforced', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'file-upload-size');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { sizeBytes, status } = await test.step('Upload a 3MB file', async () => {
      const oversized = Buffer.alloc(3 * 1024 * 1024, 'A'); // 3MB
      const upload = await uploadProfilePicture(api, session.token, { filename: 'big.png', buffer: oversized });
      const status = upload.status();
      await api.dispose();

      testInfo.attach('file-upload-size-probe', { body: JSON.stringify({ sizeBytes: oversized.length, status }, null, 2), contentType: 'application/json' });
      return { sizeBytes: oversized.length, status };
    });

    await test.step('Verify it was rejected', async () => {
      const rejectedCleanly = status === 413 || status === 400;

      if (!rejectedCleanly) {
        reporter.reportVulnerability(
          'API4_RATE_LIMIT',
          { endpoint: 'POST /upload_profile_picture', sizeBytes, status },
          ['Set MAX_CONTENT_LENGTH and/or validate uploaded file size server-side before writing it to disk.']
        );
      } else {
        reporter.reportPass(`A 3MB upload was rejected (status ${status}).`, 'API4:2023 - Unrestricted Resource Consumption');
      }
    });
  });

  test('uploaded filenames should not rely on a narrow non-cryptographic random prefix to avoid collisions', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'file-upload-naming');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const uploads = await test.step('Upload the same filename twice', async () => {
      // app.py: filename = f"{random.randint(1, 1000000)}_{filename}" — the
      // same non-cryptographic random module already flagged for the reset
      // PIN and card-number generators, here used as the sole collision guard
      // (secure_filename() only sanitizes characters, it doesn't add
      // uniqueness) across only 1,000,000 possible prefixes.
      const uploads: string[] = [];
      for (let i = 0; i < 2; i++) {
        const res = await uploadProfilePicture(api, session.token, { filename: 'same-name.png' });
        const body = await res.json().catch(() => null);
        if (body?.file_path) uploads.push(body.file_path);
      }
      await api.dispose();

      testInfo.attach('file-naming-probe', { body: JSON.stringify({ uploads }, null, 2), contentType: 'application/json' });
      return uploads;
    });

    if (uploads.length < 2) {
      reporter.reportSkip('Could not upload the same filename twice on this target.');
      return;
    }

    await test.step('Assess the filename collision risk', async () => {
      const collided = uploads[0] === uploads[1];

      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        {
          endpoint: 'POST /upload_profile_picture',
          uploads,
          collidedInThisRun: collided,
          source: "app.py: filename = f\"{random.randint(1, 1000000)}_{filename}\" — Python's non-cryptographic random module, 1,000,000-value prefix space"
        },
        [
          'Use a UUID (or secrets.token_hex) instead of random.randint(1, 1000000) for the uniqueness prefix — 1M values is a small space for a birthday-collision risk as upload volume grows.',
          'Use the secrets module rather than random for any filename/token generation, consistent with the same fix already recommended for reset PINs and card numbers.'
        ]
      );
    });
  });
});
