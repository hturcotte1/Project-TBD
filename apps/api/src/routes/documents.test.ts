import { describe, expect, it } from 'vitest';
import { createTestStudent } from '@tbd/shared/testing';
import { authHeader, makeTestApp } from '../testHelpers';

describe('documents', () => {
  it('uploads a document via multipart, queues extraction, then can be fetched and deleted', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const form = new FormData();
    form.append('kind', 'transcript');
    form.append('file', new Blob([Buffer.from('%PDF-1.4 fake pdf bytes')], { type: 'application/pdf' }), 'transcript.pdf');

    const upload = await app.inject({ method: 'POST', url: '/documents', headers, payload: form });
    expect(upload.statusCode).toBe(201);
    const doc = upload.json();
    expect(doc.kind).toBe('transcript');
    expect(doc.extraction_status).toBe('pending');
    expect(doc.url).toBeTruthy();

    expect(deps.enqueuer.ofName('agent.document_extraction').some((j) => j.payload.documentId === doc.id)).toBe(true);

    const get = await app.inject({ method: 'GET', url: `/documents/${doc.id}`, headers });
    expect(get.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/documents?kind=transcript', headers });
    expect(list.json().some((d: { id: string }) => d.id === doc.id)).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/documents/${doc.id}`, headers });
    expect(del.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: `/documents/${doc.id}`, headers });
    expect(after.statusCode).toBe(404);
  });

  it('rejects an unsupported content type', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const form = new FormData();
    form.append('kind', 'other');
    form.append('file', new Blob([Buffer.from('not allowed')], { type: 'text/plain' }), 'notes.txt');
    const res = await app.inject({ method: 'POST', url: '/documents', headers, payload: form });
    expect(res.statusCode).toBe(400);
  });

  it('cross-student: student B cannot read student A document', async () => {
    const { app, studentId: aId, token, deps } = await makeTestApp();
    const headersA = authHeader(await token(aId));
    const form = new FormData();
    form.append('kind', 'photo');
    form.append('file', new Blob([Buffer.from([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'a.jpg');
    const doc = (await app.inject({ method: 'POST', url: '/documents', headers: headersA, payload: form })).json();

    const b = await createTestStudent(deps.db, { phoneE164: null });
    const headersB = authHeader(await token(b.id));
    const res = await app.inject({ method: 'GET', url: `/documents/${doc.id}`, headers: headersB });
    expect(res.statusCode).toBe(404);
  });
});
