import StructureList from '../../src/components/admin/StructureList';

export default function AdminFacultiesScreen() {
  return (
    <StructureList
      title="Faculties"
      singular="Faculty"
      path="/admin/faculties"
      note="Superadmin only. The faculties of each university."
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'code', label: 'Code' },
        { key: 'universityId', label: 'University', ref: '/admin/universities', required: true },
      ]}
      lines={[{ label: 'University', keys: ['university', 'universityName', 'universityId'] }]}
    />
  );
}
