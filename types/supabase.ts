export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: 'teacher' | 'student' | 'pending_teacher'   // ← Added pending_teacher
          class_id: string | null
          status: string
        }
      }
    }
  }
}