-- Curriculum checklist + per-course grades, the data a student's academic
-- evaluation (and eventually a rendered TOR) is built from. `academic_records`
-- already covers per-term summaries (GPA, units, status) but has nothing at
-- the level of an individual course/grade -- this fills that gap.
--
-- curricula: one row per program per curriculum revision (e.g. "BSIT
-- 2023-2024"), matching how the registrar already tracks curricula.
-- curriculum_courses: the fixed checklist of courses for a curriculum --
-- shared across every student on that curriculum, entered once.
-- student_grades: the actual grade a specific student earned in a specific
-- course, the only per-student data in this feature.

create table curricula (
    curriculum_id uuid primary key default gen_random_uuid(),
    program_id uuid not null references programs(program_id) on delete restrict,
    curriculum_code varchar not null,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (program_id, curriculum_code)
);

create table curriculum_courses (
    curriculum_course_id uuid primary key default gen_random_uuid(),
    curriculum_id uuid not null references curricula(curriculum_id) on delete cascade,
    course_code varchar not null,
    course_name varchar not null,
    units numeric not null default 0,
    year_level varchar not null,
    term varchar not null,
    prereq_course_code varchar,
    display_order integer not null default 0,
    created_at timestamptz not null default now(),
    unique (curriculum_id, course_code)
);

create table student_grades (
    student_grade_id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(student_id) on delete cascade,
    curriculum_course_id uuid not null references curriculum_courses(curriculum_course_id) on delete restrict,
    academic_year varchar not null,
    grade varchar not null,
    remarks text,
    recorded_by uuid references employees(employee_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_id, curriculum_course_id)
);

alter table curricula enable row level security;
alter table curriculum_courses enable row level security;
alter table student_grades enable row level security;

-- Curriculum checklists are shared reference data, not sensitive -- any
-- active authenticated account can read them (a student needs their own
-- program's, staff need all of them to enter grades against).
create policy "Authenticated users can view curricula"
on curricula for select
to authenticated
using (true);

create policy "Registrar staff can manage curricula"
on curricula for all
using (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
)
with check (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
);

create policy "Authenticated users can view curriculum courses"
on curriculum_courses for select
to authenticated
using (true);

create policy "Registrar staff can manage curriculum courses"
on curriculum_courses for all
using (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
)
with check (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
);

create policy "Students can view their own grades"
on student_grades for select
using (
    exists (
        select 1 from students
        where students.student_id = student_grades.student_id
          and students.user_id = auth.uid()
    )
);

create policy "Registrar staff can manage student grades"
on student_grades for all
using (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
)
with check (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
);
