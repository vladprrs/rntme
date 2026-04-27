/**
 * Canonical Contact fixtures — short, deterministic, suitable for the generic
 * mock-vendor and acceptable for live-vendor smoke runs.
 */

export const aliceFields = {
  email: 'alice@acme.example',
  phone: '+14155551212',
  name: { given: 'Alice', family: 'Smith', display: 'Alice Smith' },
  title: 'VP Engineering',
  tags: ['vip', 'q4-target'],
};

export const bobFields = {
  email: 'bob@acme.example',
  phone: '+14155551313',
  name: { given: 'Bob', family: 'Jones', display: 'Bob Jones' },
  title: 'Procurement Manager',
};

export const charlieFields = {
  email: 'charlie@globex.example',
  phone: '+44 20 7946 0958',
  name: { given: 'Charlie', family: 'Brown' },
};

/** Used in negative-path scenarios (duplicate-detection by email). */
export const aliceDuplicate = aliceFields;
