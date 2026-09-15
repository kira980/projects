const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// The loader has only erased type imports; exercise it without a server or DB.
const source = fs.readFileSync(path.join(__dirname, '../../src/lib/builder/website-data.ts'), 'utf8')
const exportsObject = {}
new Function('exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(exportsObject)
const { getBuilderWebsiteData } = exportsObject

function fixture(errors = {}, staff = [{ id: 'staff-a', business_id: 'tenant-a' }]) {
  const records = {
    businesses: { id: 'tenant-a', name: 'Studio' },
    services: [{ id: 'service-a', name: 'Consultation', image_url: '/actual-photo.jpg' }],
    service_categories: [{ id: 'category-a', name: 'Consultations' }],
    staff_members: staff,
    staff_services: [{ staff_member_id: 'staff-a', service_id: 'service-a' }],
    working_hours: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
  }
  const queries = []
  const client = { from(table) {
    const query = { table, filters: [] }; queries.push(query)
    const chain = {
      select(fields) { query.fields = fields; return chain },
      eq(key, value) { query.filters.push([key, value]); return chain },
      in(key, value) { query.filters.push([key, value]); return chain },
      order() { return chain }, single() { return chain },
      then(resolve, reject) {
        return Promise.resolve({ data: errors[table] ? null : records[table], error: errors[table] || null }).then(resolve, reject)
      },
    }
    return chain
  } }
  return { client, queries, records }
}
const missing = (table, code = 'PGRST205') => ({ code, message: `Could not find the table 'public.${table}' in the schema cache` })

for (const code of ['PGRST205', '42P01']) {
  test(`loads real business data before optional migrations (${code})`, async () => {
    const { client, records } = fixture({ service_categories: missing('service_categories', code), staff_services: missing('staff_services', code) })
    const data = await getBuilderWebsiteData(client, 'tenant-a')
    assert.deepEqual(data.categories, [])
    assert.deepEqual(data.staffServices, [])
    assert.deepEqual(data.services, records.services)
    assert.deepEqual(data.staff, records.staff_members)
    assert.deepEqual(data.workingHours, records.working_hours)
    assert.equal(data.business.name, 'Studio')
  })
}

test('preserves categories and staff assignments after migration and scopes all reads', async () => {
  const { client, queries, records } = fixture()
  const data = await getBuilderWebsiteData(client, 'tenant-a')
  assert.deepEqual(data.categories, records.service_categories)
  assert.deepEqual(data.staffServices, records.staff_services)
  for (const q of queries) {
    const key = q.table === 'businesses' ? 'id' : q.table === 'staff_services' ? 'staff_member_id' : 'business_id'
    assert.deepEqual(q.filters.find(([k]) => k === key)?.[1], q.table === 'staff_services' ? ['staff-a'] : 'tenant-a')
    if (['services', 'staff_members'].includes(q.table)) assert.deepEqual(q.filters.find(([k]) => k === 'active'), ['active', true])
  }
  assert(!queries[0].fields.includes('*'))
  assert(!queries[0].fields.includes('admin_password'))
})

test('does not mask permissions, network errors, or missing required data', async () => {
  for (const table of ['service_categories', 'staff_services']) {
    for (const error of [{ code: '42501', message: 'permission denied' }, { code: '', message: 'fetch failed' }, missing('unrelated_table')]) {
      await assert.rejects(getBuilderWebsiteData(fixture({ [table]: error }).client, 'tenant-a'), /Could not load/)
    }
  }
  for (const table of ['businesses', 'services', 'staff_members', 'working_hours']) {
    await assert.rejects(getBuilderWebsiteData(fixture({ [table]: missing(table) }).client, 'tenant-a'), /Could not load/)
  }
})

test('skips assignment lookup when the business has no staff', async () => {
  const { client, queries } = fixture({}, [])
  const data = await getBuilderWebsiteData(client, 'tenant-a')
  assert.deepEqual(data.staffServices, [])
  assert(!queries.some(q => q.table === 'staff_services'))
})
