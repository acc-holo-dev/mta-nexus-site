/** Shared master-list binary fixture builders for MTA directory service suites. */

const FLAGS = 0x0004 | 0x0008 | 0x0020 | 0x0040 | 0x0080 | 0x0100 | 0x0200 | 0x1000 | 0x080000;

export function u16(value: number) {
  return [(value >>> 8) & 0xff, value & 0xff];
}

export function u32(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

export function text(value: string) {
  const bytes = [...new TextEncoder().encode(value)];
  return [bytes.length, ...bytes];
}

/** Canonical extended master-list payload with one Nexus test server entry. */
export function fixture() {
  const entry = [
    127,
    0,
    0,
    1,
    ...u16(22003),
    ...u16(42),
    ...u16(128),
    ...text("Nexus test server"),
    ...text("roleplay"),
    ...text("Los Santos"),
    ...text("1.6"),
    1,
    0,
    ...u16(22005),
  ];

  return new Uint8Array([
    0,
    0,
    0,
    2,
    ...u32(FLAGS),
    ...u32(7),
    ...u32(1),
    ...u16(entry.length + 2),
    ...entry,
    0x12,
    0x34,
    0x56,
    0x79,
  ]).buffer;
}
