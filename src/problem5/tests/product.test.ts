import './setup';

import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma, prisma } from '../src/utils/prisma';
import type { CreateProductInput } from '../src/types/product.types';

/**
 * Integration test suite for the product CRUD endpoints.
 *
 * Tests are database-provider agnostic — no assertions depend on SQLite or
 * PostgreSQL specifics, which means the same suite is the source of truth
 * whether the developer runs against `file:./test.db` or a real PG URL.
 *
 * Product endpoints are mounted under `/api/products` by the app bootstrap
 * in `src/app.ts`. Keep that base path centralised so any future mount
 * change only touches a single line in the suite.
 */
const baseUrl = '/api/products';

const sampleProduct: CreateProductInput = {
  name: 'Ergo Keyboard',
  description: 'Split mechanical keyboard for comfortable typing.',
  price: 249.99,
  category: 'peripherals',
};

async function clearProducts(): Promise<void> {
  await prisma.product.deleteMany({});
}

beforeAll(async () => {
  await clearProducts();
});

afterEach(async () => {
  await clearProducts();
});

afterAll(async () => {
  await disconnectPrisma();
});

describe(`POST ${baseUrl}`, () => {
  it('creates a product and returns 201 with the DTO envelope', async () => {
    const response = await request(app).post(baseUrl).send(sampleProduct);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        name: sampleProduct.name,
        description: sampleProduct.description,
        price: sampleProduct.price,
        category: sampleProduct.category,
      },
    });

    const data = response.body.data as { id?: string; createdAt?: string };
    expect(typeof data.id).toBe('string');
    expect(typeof data.createdAt).toBe('string');
  });

  it('rejects an invalid body with 400', async () => {
    const response = await request(app)
      .post(baseUrl)
      .send({ name: '', price: -1, category: '' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('rejects a missing body with 400', async () => {
    const response = await request(app).post(baseUrl).send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('rejects malformed JSON with 400 (not 500)', async () => {
    const response = await request(app)
      .post(baseUrl)
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'BAD_REQUEST' },
    });
  });
});

describe(`GET ${baseUrl}`, () => {
  it('returns a paginated list with meta', async () => {
    await request(app).post(baseUrl).send(sampleProduct);
    await request(app)
      .post(baseUrl)
      .send({ ...sampleProduct, name: 'Trackball Mouse', category: 'peripherals' });
    await request(app)
      .post(baseUrl)
      .send({ ...sampleProduct, name: 'Desk Lamp', category: 'lighting' });

    const response = await request(app).get(baseUrl).query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(3);
    expect(response.body.meta).toEqual({ page: 1, limit: 10, total: 3 });
  });

  it('filters by category (exact match)', async () => {
    await request(app).post(baseUrl).send(sampleProduct);
    await request(app)
      .post(baseUrl)
      .send({ ...sampleProduct, name: 'Desk Lamp', category: 'lighting' });

    const response = await request(app).get(baseUrl).query({ category: 'lighting' });

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    const first = response.body.data[0] as { category: string };
    expect(first.category).toBe('lighting');
  });

  it('filters by name (case-insensitive contains)', async () => {
    await request(app).post(baseUrl).send(sampleProduct);
    await request(app)
      .post(baseUrl)
      .send({ ...sampleProduct, name: 'Desk Lamp', category: 'lighting' });

    const response = await request(app).get(baseUrl).query({ name: 'ergo' });

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    const first = response.body.data[0] as { name: string };
    expect(first.name.toLowerCase()).toContain('ergo');
  });

  it('rejects invalid pagination values with 400', async () => {
    const response = await request(app)
      .get(baseUrl)
      .query({ page: 'abc', limit: 10 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe(`GET ${baseUrl}/:id`, () => {
  it('returns the product for a known id', async () => {
    const created = await request(app).post(baseUrl).send(sampleProduct);
    const { id } = created.body.data as { id: string };

    const response = await request(app).get(`${baseUrl}/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({ id, name: sampleProduct.name });
  });

  it('returns 404 for an unknown but well-formed id', async () => {
    // Well-formed but non-existent cuid — 25 chars, starts with `c`.
    const missingId = 'cjld2cjxh0000qzrmn831i7rn';
    const response = await request(app).get(`${baseUrl}/${missingId}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const response = await request(app).get(`${baseUrl}/not-a-cuid`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe(`PATCH ${baseUrl}/:id`, () => {
  it('applies a partial update and returns the new DTO', async () => {
    const created = await request(app).post(baseUrl).send(sampleProduct);
    const { id } = created.body.data as { id: string };

    const response = await request(app)
      .patch(`${baseUrl}/${id}`)
      .send({ price: 299.5 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({ id, price: 299.5, name: sampleProduct.name });
  });

  it('rejects an empty body with 400', async () => {
    const created = await request(app).post(baseUrl).send(sampleProduct);
    const { id } = created.body.data as { id: string };

    const response = await request(app).patch(`${baseUrl}/${id}`).send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('returns 404 when updating an unknown id', async () => {
    const missingId = 'cjld2cjxh0000qzrmn831i7rn';
    const response = await request(app)
      .patch(`${baseUrl}/${missingId}`)
      .send({ price: 10 });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe(`DELETE ${baseUrl}/:id`, () => {
  it('deletes an existing product and returns 204 with empty body', async () => {
    const created = await request(app).post(baseUrl).send(sampleProduct);
    const { id } = created.body.data as { id: string };

    const response = await request(app).delete(`${baseUrl}/${id}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(response.text).toBe('');

    const afterDelete = await request(app).get(`${baseUrl}/${id}`);
    expect(afterDelete.status).toBe(404);
  });

  it('returns 404 when deleting an unknown id', async () => {
    const missingId = 'cjld2cjxh0000qzrmn831i7rn';
    const response = await request(app).delete(`${baseUrl}/${missingId}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
