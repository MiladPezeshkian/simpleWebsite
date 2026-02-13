
-- Create enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('professor');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile and assign professor role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'professor');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  term TEXT NOT NULL,
  professor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can view own classes" ON public.classes FOR SELECT USING (auth.uid() = professor_id);
CREATE POLICY "Professors can create classes" ON public.classes FOR INSERT WITH CHECK (auth.uid() = professor_id);
CREATE POLICY "Professors can update own classes" ON public.classes FOR UPDATE USING (auth.uid() = professor_id);
CREATE POLICY "Professors can delete own classes" ON public.classes FOR DELETE USING (auth.uid() = professor_id);

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can view students in own classes" ON public.students FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = students.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can insert students in own classes" ON public.students FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = students.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can update students in own classes" ON public.students FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = students.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can delete students in own classes" ON public.students FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = students.class_id AND classes.professor_id = auth.uid()));

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, date)
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can view sessions in own classes" ON public.sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = sessions.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can create sessions in own classes" ON public.sessions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = sessions.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can update sessions in own classes" ON public.sessions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = sessions.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can delete sessions in own classes" ON public.sessions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = sessions.class_id AND classes.professor_id = auth.uid()));

-- Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'absent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can view attendance in own classes" ON public.attendance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = attendance.session_id AND c.professor_id = auth.uid()
  ));
CREATE POLICY "Professors can insert attendance in own classes" ON public.attendance FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = attendance.session_id AND c.professor_id = auth.uid()
  ));
CREATE POLICY "Professors can update attendance in own classes" ON public.attendance FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = attendance.session_id AND c.professor_id = auth.uid()
  ));

-- Grades table
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  midterm NUMERIC(5,2) DEFAULT 0,
  final NUMERIC(5,2) DEFAULT 0,
  activity NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can view grades in own classes" ON public.grades FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = grades.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can insert grades in own classes" ON public.grades FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = grades.class_id AND classes.professor_id = auth.uid()));
CREATE POLICY "Professors can update grades in own classes" ON public.grades FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = grades.class_id AND classes.professor_id = auth.uid()));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
