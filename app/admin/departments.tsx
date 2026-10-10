import StructureList from '../../src/components/admin/StructureList';

export default function AdminDepartmentsScreen() {
  return (
    <StructureList
      title="Departments"
      singular="Department"
      path="/admin/departments"
      note="Superadmin only. The departments of each faculty."
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'code', label: 'Code' },
        { key: 'facultyId', label: 'Faculty', ref: '/admin/faculties', required: true },
      ]}
      lines={[
        { label: 'Faculty', keys: ['faculty', 'facultyName', 'facultyId'] },
        { label: 'University', keys: ['university', 'universityName', 'universityId'] },
      ]}
    />
  );
}
