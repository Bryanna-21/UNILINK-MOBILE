import StructureList from '../../src/components/admin/StructureList';

export default function AdminCampusesScreen() {
  return (
    <StructureList
      title="Campuses"
      singular="Campus"
      path="/admin/campuses"
      note="Superadmin only. The campuses of each university."
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'code', label: 'Code' },
        { key: 'universityId', label: 'University', ref: '/admin/universities', required: true },
      ]}
      lines={[{ label: 'University', keys: ['university', 'universityName', 'universityId'] }]}
    />
  );
}
