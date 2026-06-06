'use client';

import { useEffect } from 'react';
import { migrateDexieToFirestore } from '~/infrastructure/db/db-migration';

export function DbMigration() {
  useEffect(() => {
    migrateDexieToFirestore();
  }, []);

  return null;
}
