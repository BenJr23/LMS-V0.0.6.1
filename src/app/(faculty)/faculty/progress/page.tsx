"use client";
import { useState, useEffect } from "react";
import { getClassroomProgress } from "@/app/_actions/progress";
import { getSubjectInstances } from "@/app/_actions/subjectInstance";

type Student = { id: string; name: string };
type Requirement = { id: string; title: string };
type Submission = { requirementId: string; studentId: string };
type Classroom = {
  id: string;
  section: string;
  subject?: { name: string };
};
type ProgressClassroom = {
  id: string;
  name: string;
  section: string;
  requirements: Requirement[];
  students: Student[];
  submissions: Submission[];
};

export default function FacultyProgressPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState<ProgressClassroom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all classrooms for this faculty on mount
  useEffect(() => {
    async function fetchClassrooms() {
      setLoading(true);
      setError(null);
      try {
        const res = await getSubjectInstances();
        if (res && res.success && res.data) {
          setClassrooms(res.data);
        } else {
          setError(res?.error || "Failed to fetch classrooms");
        }
      } catch {
        setError("Failed to fetch classrooms");
      } finally {
        setLoading(false);
      }
    }
    fetchClassrooms();
  }, []);

  // Fetch progress for selected classroom
  useEffect(() => {
    if (!selectedClassroomId) {
      setSelectedClassroom(null);
      return;
    }
    setLoading(true);
    setError(null);
    getClassroomProgress(selectedClassroomId)
      .then((res) => {
        if (res && res.success && res.data) {
          setSelectedClassroom(res.data);
        } else {
          setSelectedClassroom(null);
          setError(res?.error || "Failed to fetch classroom progress");
        }
      })
      .catch(() => {
        setSelectedClassroom(null);
        setError("Failed to fetch classroom progress");
      })
      .finally(() => setLoading(false));
  }, [selectedClassroomId]);

  // Calculate per-student progress
  const studentsWithProgress = (selectedClassroom?.students || []).map((student) => {
    const submitted = (selectedClassroom?.requirements || []).filter((req) =>
      (selectedClassroom?.submissions || []).some(
        (s) => s.requirementId === req.id && s.studentId === student.id
      )
    ).length;
    return {
      ...student,
      submitted,
      total: selectedClassroom?.requirements?.length || 0,
    };
  });

  // Calculate overall progress: % of students who submitted all requirements
  const totalStudents = studentsWithProgress.length;
  const studentsComplete = studentsWithProgress.filter(
    (s) => s.submitted === s.total && s.total > 0
  ).length;
  const overallPercent = totalStudents > 0 ? Math.round((studentsComplete / totalStudents) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-800">
      <h1 className="text-2xl font-bold mb-6 text-[#800000]">Classroom Progress</h1>
      {/* Classroom Selector */}
      <div className="mb-6">
        <label className="block mb-1 font-medium">Select Classroom</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={selectedClassroomId}
          onChange={(e) => setSelectedClassroomId(e.target.value)}
        >
          <option value="">-- Choose a classroom --</option>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.subject?.name || c.id} (Section {c.section})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#800000]"></div>
        </div>
      )}
      {error && (
        <div className="text-red-600 font-semibold mb-4">{error}</div>
      )}

      {/* Overall Progress */}
      {selectedClassroom && !loading && !error && (
        <div className="mb-8">
          <div className="flex justify-between mb-1 text-sm">
            <span>Overall Progress</span>
            <span>{overallPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div
              className="bg-[#800000] h-4 rounded-full transition-all"
              style={{ width: `${overallPercent}%` }}
            ></div>
          </div>
          {/* Student List */}
          <table className="w-full text-left mt-4">
            <thead>
              <tr>
                <th className="py-2 px-2 font-semibold text-[#800000]">Student</th>
                <th className="py-2 px-2 font-semibold text-[#800000]">Progress</th>
                <th className="py-2 px-2 font-semibold text-[#800000]">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {studentsWithProgress.map((student) => {
                const percent = student.total > 0 ? Math.round((student.submitted / student.total) * 100) : 0;
                return (
                  <tr key={student.id} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-2 font-medium text-gray-900">{student.name}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">
                          {student.submitted}/{student.total}
                        </span>
                        <div className="w-28 bg-gray-200 rounded-full h-3 shadow-inner">
                          <div
                            className={
                              percent === 100
                                ? "bg-green-500 h-3 rounded-full"
                                : percent === 0
                                ? "bg-red-400 h-3 rounded-full"
                                : "bg-yellow-400 h-3 rounded-full"
                            }
                            style={{
                              width: `${percent}%`,
                              boxShadow: percent > 0 ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 font-semibold text-gray-700 text-center">
                      <span
                        className={
                          percent === 100
                            ? "text-green-600"
                            : percent === 0
                            ? "text-red-500"
                            : "text-yellow-600"
                        }
                      >
                        {percent}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
