import { useState, useEffect } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import type {
  CandidateProfileDto,
  CandidateExperienceDto,
  CandidateEducationDto,
  CandidateProjectDto,
  CandidateSkillDto,
  CandidateLanguageDto,
  CandidateCertificationDto,
  CandidateLinkDto,
  CandidateFactDto,
} from '@job-agent/shared';

type ProfileTab =
  | 'personal'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'languages'
  | 'certifications'
  | 'links'
  | 'facts';

interface Props {
  initialTab?: string;
  onUpdate?: () => void;
}

export function ProfileView({ initialTab, onUpdate }: Props) {
  const [tab, setTab] = useState<ProfileTab>((initialTab as ProfileTab) || 'personal');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  // Data states
  const [profile, setProfile] = useState<CandidateProfileDto | null>(null);
  const [experiences, setExperiences] = useState<CandidateExperienceDto[]>([]);
  const [education, setEducation] = useState<CandidateEducationDto[]>([]);
  const [projects, setProjects] = useState<CandidateProjectDto[]>([]);
  const [skills, setSkills] = useState<CandidateSkillDto[]>([]);
  const [languages, setLanguages] = useState<CandidateLanguageDto[]>([]);
  const [certifications, setCertifications] = useState<CandidateCertificationDto[]>([]);
  const [links, setLinks] = useState<CandidateLinkDto[]>([]);
  const [facts, setFacts] = useState<CandidateFactDto[]>([]);

  // Editing state for modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null);

  const showToast = (type: 'ok' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, expRes, eduRes, projRes, skillsRes, langRes, certRes, linksRes, factsRes] =
        await Promise.all([
          candidateApi.getProfile(),
          candidateApi.getExperiences(),
          candidateApi.getEducation(),
          candidateApi.getProjects(),
          candidateApi.getSkills(),
          candidateApi.getLanguages(),
          candidateApi.getCertifications(),
          candidateApi.getLinks(),
          candidateApi.getFacts(),
        ]);

      setProfile(profileRes);
      setExperiences(expRes);
      setEducation(eduRes);
      setProjects(projRes);
      setSkills(skillsRes);
      setLanguages(langRes);
      setCertifications(certRes);
      setLinks(linksRes);
      setFacts(factsRes);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to fetch candidate profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab as ProfileTab);
    }
  }, [initialTab]);

  // Handle Profile Update
  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<CandidateProfileDto> = {
      fullName: (formData.get('fullName') as string) || null,
      preferredName: (formData.get('preferredName') as string) || null,
      headline: (formData.get('headline') as string) || null,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      city: (formData.get('city') as string) || null,
      region: (formData.get('region') as string) || null,
      country: (formData.get('country') as string) || null,
      summary: (formData.get('summary') as string) || null,
      availability: (formData.get('availability') as string) || null,
    };

    try {
      const updated = await candidateApi.updateProfile(data);
      setProfile(updated);
      showToast('ok', 'Personal profile updated successfully');
      onUpdate?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed');
    }
  };

  // Helper for generic list deletion
  const handleDelete = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      if (type === 'experience') await candidateApi.deleteExperience(id);
      if (type === 'education') await candidateApi.deleteEducation(id);
      if (type === 'project') await candidateApi.deleteProject(id);
      if (type === 'skill') await candidateApi.deleteSkill(id);
      if (type === 'language') await candidateApi.deleteLanguage(id);
      if (type === 'certification') await candidateApi.deleteCertification(id);
      if (type === 'link') await candidateApi.deleteLink(id);
      if (type === 'fact') await candidateApi.deleteFact(id);

      showToast('ok', `${type} deleted`);
      loadData();
      onUpdate?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'experience', label: 'Experience', count: experiences.length },
    { id: 'education', label: 'Education', count: education.length },
    { id: 'projects', label: 'Projects', count: projects.length },
    { id: 'skills', label: 'Skills', count: skills.length },
    { id: 'languages', label: 'Languages', count: languages.length },
    { id: 'certifications', label: 'Certifications', count: certifications.length },
    { id: 'links', label: 'Links', count: links.length },
    { id: 'facts', label: 'Verified Facts', count: facts.length },
  ];

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Candidate Profile</h1>
        <p className="page-subtitle">
          Manage your verified professional identity, credentials, and facts
        </p>
      </header>

      {toast && (
        <div
          className={`info-banner ${toast.type === 'error' ? 'error' : ''}`}
          style={{
            borderColor: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
            backgroundColor:
              toast.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Profile Subnav Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--surface-border)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setTab(t.id)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {t.label} {t.count !== undefined ? `(${t.count})` : ''}
          </button>
        ))}
      </div>

      {loading && !profile ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          Loading profile data...
        </div>
      ) : null}

      {/* 1. PERSONAL INFO TAB */}
      {tab === 'personal' && (
        <div className="card">
          <div className="card-title">Personal Information & Bio</div>
          <form onSubmit={handleProfileSave}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  className="form-input"
                  defaultValue={profile?.fullName || ''}
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Name / Alias</label>
                <input
                  type="text"
                  name="preferredName"
                  className="form-input"
                  defaultValue={profile?.preferredName || ''}
                  placeholder="e.g. Jane"
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Professional Headline</label>
                <input
                  type="text"
                  name="headline"
                  className="form-input"
                  defaultValue={profile?.headline || ''}
                  placeholder="e.g. Senior Full-Stack Engineer | TypeScript & Cloud Architecture"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  defaultValue={profile?.email || ''}
                  placeholder="e.g. jane@example.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  defaultValue={profile?.phone || ''}
                  placeholder="e.g. +1 (555) 019-2834"
                />
              </div>

              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  name="city"
                  className="form-input"
                  defaultValue={profile?.city || ''}
                  placeholder="e.g. Berlin"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Country</label>
                <input
                  type="text"
                  name="country"
                  className="form-input"
                  defaultValue={profile?.country || ''}
                  placeholder="e.g. Germany"
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Availability / Notice Period</label>
                <input
                  type="text"
                  name="availability"
                  className="form-input"
                  defaultValue={profile?.availability || ''}
                  placeholder="e.g. 1 month notice, available May 1st"
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Professional Summary</label>
                <textarea
                  name="summary"
                  className="form-textarea"
                  rows={4}
                  defaultValue={profile?.summary || ''}
                  placeholder="A concise, factual executive summary of your background and strengths..."
                />
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">
                Save Personal Info
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. EXPERIENCE TAB */}
      {tab === 'experience' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Work Experience</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({ isCurrent: false, achievements: [] });
                setModalMode('create');
              }}
            >
              + Add Experience
            </button>
          </div>

          {experiences.length === 0 ? (
            <div className="card placeholder-view">
              No experience records yet. Add your work history.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {experiences.map((exp) => (
                <div key={exp.id} className="card" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{exp.position}</h3>
                      <div style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '0.95rem' }}>
                        {exp.organization} {exp.location ? `• ${exp.location}` : ''}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.8rem',
                          marginTop: '0.2rem',
                        }}
                      >
                        {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate || 'N/A'}{' '}
                        {exp.employmentType ? `(${exp.employmentType})` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setActiveItem(exp);
                          setModalMode('edit');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete('experience', exp.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {exp.description && (
                    <p
                      style={{
                        marginTop: '0.75rem',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {exp.description}
                    </p>
                  )}
                  {exp.achievements && exp.achievements.length > 0 && (
                    <ul
                      style={{
                        marginTop: '0.5rem',
                        paddingLeft: '1.25rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {exp.achievements.map((ach, i) => (
                        <li key={i}>{ach}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. EDUCATION TAB */}
      {tab === 'education' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Education</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({ isCurrent: false });
                setModalMode('create');
              }}
            >
              + Add Education
            </button>
          </div>

          {education.length === 0 ? (
            <div className="card placeholder-view">No education records yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {education.map((edu) => (
                <div key={edu.id} className="card" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{edu.institution}</h3>
                      <div style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '0.95rem' }}>
                        {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.8rem',
                          marginTop: '0.2rem',
                        }}
                      >
                        {edu.startDate || 'N/A'} –{' '}
                        {edu.isCurrent ? 'Present' : edu.endDate || 'N/A'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setActiveItem(edu);
                          setModalMode('edit');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete('education', edu.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {edu.description && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>{edu.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. PROJECTS TAB */}
      {tab === 'projects' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Projects</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({ skills: [], achievements: [] });
                setModalMode('create');
              }}
            >
              + Add Project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="card placeholder-view">No projects added yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {projects.map((proj) => (
                <div key={proj.id} className="card" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{proj.name}</h3>
                      {proj.role && (
                        <div style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
                          {proj.role}
                        </div>
                      )}
                      {proj.projectUrl && (
                        <a
                          href={proj.projectUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.8rem', color: '#93c5fd' }}
                        >
                          {proj.projectUrl}
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setActiveItem(proj);
                          setModalMode('edit');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete('project', proj.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {proj.description && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>{proj.description}</p>
                  )}
                  {proj.skills && proj.skills.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.35rem',
                        marginTop: '0.75rem',
                      }}
                    >
                      {proj.skills.map((s, idx) => (
                        <span key={idx} className="nav-tag">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. SKILLS TAB */}
      {tab === 'skills' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Skills</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({ verificationStatus: 'VERIFIED' });
                setModalMode('create');
              }}
            >
              + Add Skill
            </button>
          </div>

          {skills.length === 0 ? (
            <div className="card placeholder-view">No skills recorded yet.</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  style={{
                    backgroundColor: 'var(--surface-color)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{skill.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {skill.category || 'General'}{' '}
                      {skill.proficiency ? `• ${skill.proficiency}` : ''}{' '}
                      {skill.yearsExperience ? `(${skill.yearsExperience} yrs)` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setActiveItem(skill);
                        setModalMode('edit');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      onClick={() => handleDelete('skill', skill.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. LANGUAGES TAB */}
      {tab === 'languages' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Languages</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({ proficiency: 'PROFICIENT' });
                setModalMode('create');
              }}
            >
              + Add Language
            </button>
          </div>

          {languages.length === 0 ? (
            <div className="card placeholder-view">No languages added yet.</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {languages.map((l) => (
                <div
                  key={l.id}
                  style={{
                    backgroundColor: 'var(--surface-color)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{l.language}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {l.proficiency} {l.cefrLevel ? `(${l.cefrLevel})` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setActiveItem(l);
                        setModalMode('edit');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      onClick={() => handleDelete('language', l.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. CERTIFICATIONS TAB */}
      {tab === 'certifications' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Certifications</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({});
                setModalMode('create');
              }}
            >
              + Add Certification
            </button>
          </div>

          {certifications.length === 0 ? (
            <div className="card placeholder-view">No certifications added yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {certifications.map((c) => (
                <div key={c.id} className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{c.name}</h3>
                      <div style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                        {c.issuingOrganization}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          marginTop: '0.2rem',
                        }}
                      >
                        Issued: {c.issueDate || 'N/A'}{' '}
                        {c.expirationDate ? `| Expires: ${c.expirationDate}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setActiveItem(c);
                          setModalMode('edit');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete('certification', c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. LINKS TAB */}
      {tab === 'links' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Professional Links</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({});
                setModalMode('create');
              }}
            >
              + Add Link
            </button>
          </div>

          {links.length === 0 ? (
            <div className="card placeholder-view">
              No links added yet. Add GitHub, LinkedIn, or Portfolio.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {links.map((link) => (
                <div
                  key={link.id}
                  style={{
                    backgroundColor: 'var(--surface-color)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, marginRight: '0.75rem' }}>{link.label}:</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#93c5fd', fontSize: '0.9rem' }}
                    >
                      {link.url}
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setActiveItem(link);
                        setModalMode('edit');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      onClick={() => handleDelete('link', link.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. FACTS TAB */}
      {tab === 'facts' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Verified Candidate Facts</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Explicit atomic truths authorized for AI evaluation and application generation.
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setActiveItem({
                  allowAiUse: true,
                  verificationStatus: 'VERIFIED',
                  category: 'EXPERIENCE',
                });
                setModalMode('create');
              }}
            >
              + Add Fact
            </button>
          </div>

          {facts.length === 0 ? (
            <div className="card placeholder-view">No verified facts recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {facts.map((fact) => (
                <div key={fact.id} className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span
                          className="nav-tag"
                          style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}
                        >
                          {fact.category}
                        </span>
                        <code style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                          {fact.factKey}
                        </code>
                        <span
                          className={`status-badge ${fact.verificationStatus === 'VERIFIED' ? 'ok' : 'degraded'}`}
                          style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}
                        >
                          {fact.verificationStatus}
                        </span>
                        {fact.allowAiUse ? (
                          <span
                            className="status-badge ok"
                            style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}
                          >
                            ✓ AI-Allowed
                          </span>
                        ) : (
                          <span
                            className="status-badge error"
                            style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}
                          >
                            AI-Blocked
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{fact.statement}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setActiveItem(fact);
                          setModalMode('edit');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete('fact', fact.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL FOR ADD/EDIT ITEMS */}
      {modalMode && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                {modalMode === 'create' ? 'Add' : 'Edit'}{' '}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setModalMode(null);
                  setActiveItem(null);
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                try {
                  if (tab === 'experience') {
                    const data: any = {
                      organization: form.get('organization') as string,
                      position: form.get('position') as string,
                      location: (form.get('location') as string) || null,
                      employmentType: (form.get('employmentType') as string) || null,
                      startDate: form.get('startDate') as string,
                      endDate: (form.get('endDate') as string) || null,
                      isCurrent: form.get('isCurrent') === 'on',
                      description: (form.get('description') as string) || null,
                      achievements: ((form.get('achievements') as string) || '')
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    };
                    if (modalMode === 'create') await candidateApi.createExperience(data);
                    else await candidateApi.updateExperience(activeItem.id, data);
                  } else if (tab === 'education') {
                    const data: any = {
                      institution: form.get('institution') as string,
                      degree: (form.get('degree') as string) || null,
                      fieldOfStudy: (form.get('fieldOfStudy') as string) || null,
                      startDate: (form.get('startDate') as string) || null,
                      endDate: (form.get('endDate') as string) || null,
                      isCurrent: form.get('isCurrent') === 'on',
                      description: (form.get('description') as string) || null,
                    };
                    if (modalMode === 'create') await candidateApi.createEducation(data);
                    else await candidateApi.updateEducation(activeItem.id, data);
                  } else if (tab === 'projects') {
                    const data: any = {
                      name: form.get('name') as string,
                      role: (form.get('role') as string) || null,
                      projectUrl: (form.get('projectUrl') as string) || null,
                      description: (form.get('description') as string) || null,
                      skills: ((form.get('skills') as string) || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    };
                    if (modalMode === 'create') await candidateApi.createProject(data);
                    else await candidateApi.updateProject(activeItem.id, data);
                  } else if (tab === 'skills') {
                    const data: any = {
                      name: form.get('name') as string,
                      category: (form.get('category') as string) || null,
                      proficiency: (form.get('proficiency') as string) || null,
                      yearsExperience: form.get('yearsExperience')
                        ? Number(form.get('yearsExperience'))
                        : null,
                    };
                    if (modalMode === 'create') await candidateApi.createSkill(data);
                    else await candidateApi.updateSkill(activeItem.id, data);
                  } else if (tab === 'languages') {
                    const data: any = {
                      language: form.get('language') as string,
                      proficiency: form.get('proficiency') as string,
                      cefrLevel: (form.get('cefrLevel') as string) || null,
                    };
                    if (modalMode === 'create') await candidateApi.createLanguage(data);
                    else await candidateApi.updateLanguage(activeItem.id, data);
                  } else if (tab === 'certifications') {
                    const data: any = {
                      name: form.get('name') as string,
                      issuingOrganization: form.get('issuingOrganization') as string,
                      issueDate: (form.get('issueDate') as string) || null,
                      expirationDate: (form.get('expirationDate') as string) || null,
                      credentialUrl: (form.get('credentialUrl') as string) || null,
                    };
                    if (modalMode === 'create') await candidateApi.createCertification(data);
                    else await candidateApi.updateCertification(activeItem.id, data);
                  } else if (tab === 'links') {
                    const data: any = {
                      label: form.get('label') as string,
                      url: form.get('url') as string,
                    };
                    if (modalMode === 'create') await candidateApi.createLink(data);
                    else await candidateApi.updateLink(activeItem.id, data);
                  } else if (tab === 'facts') {
                    const data: any = {
                      category: form.get('category') as string,
                      factKey: form.get('factKey') as string,
                      statement: form.get('statement') as string,
                      allowAiUse: form.get('allowAiUse') === 'on',
                      verificationStatus: form.get('verificationStatus') as any,
                    };
                    if (modalMode === 'create') await candidateApi.createFact(data);
                    else await candidateApi.updateFact(activeItem.id, data);
                  }

                  showToast('ok', 'Saved successfully');
                  setModalMode(null);
                  setActiveItem(null);
                  loadData();
                  onUpdate?.();
                } catch (err) {
                  showToast('error', err instanceof Error ? err.message : 'Save failed');
                }
              }}
            >
              {/* Dynamic form fields depending on active tab */}
              {tab === 'experience' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Position / Title</label>
                    <input
                      name="position"
                      defaultValue={activeItem?.position || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Organization / Company</label>
                    <input
                      name="organization"
                      defaultValue={activeItem?.organization || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      name="location"
                      defaultValue={activeItem?.location || ''}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <input
                      name="employmentType"
                      defaultValue={activeItem?.employmentType || ''}
                      placeholder="Full-time, Contract, etc."
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      name="startDate"
                      defaultValue={activeItem?.startDate || ''}
                      placeholder="YYYY-MM"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      name="endDate"
                      defaultValue={activeItem?.endDate || ''}
                      placeholder="YYYY-MM or leave empty if current"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="isCurrent"
                        defaultChecked={activeItem?.isCurrent}
                      />
                      <span>Current Position</span>
                    </label>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      defaultValue={activeItem?.description || ''}
                      rows={3}
                      className="form-textarea"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Key Achievements (one per line)</label>
                    <textarea
                      name="achievements"
                      defaultValue={activeItem?.achievements?.join('\n') || ''}
                      rows={3}
                      className="form-textarea"
                    />
                  </div>
                </div>
              )}

              {tab === 'education' && (
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Institution / University</label>
                    <input
                      name="institution"
                      defaultValue={activeItem?.institution || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Degree</label>
                    <input
                      name="degree"
                      defaultValue={activeItem?.degree || ''}
                      placeholder="B.Sc., M.Sc., etc."
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Field of Study</label>
                    <input
                      name="fieldOfStudy"
                      defaultValue={activeItem?.fieldOfStudy || ''}
                      placeholder="Computer Science"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      name="startDate"
                      defaultValue={activeItem?.startDate || ''}
                      placeholder="YYYY-MM"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      name="endDate"
                      defaultValue={activeItem?.endDate || ''}
                      placeholder="YYYY-MM"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Description / Activities</label>
                    <textarea
                      name="description"
                      defaultValue={activeItem?.description || ''}
                      rows={2}
                      className="form-textarea"
                    />
                  </div>
                </div>
              )}

              {tab === 'projects' && (
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Project Name</label>
                    <input
                      name="name"
                      defaultValue={activeItem?.name || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Role</label>
                    <input
                      name="role"
                      defaultValue={activeItem?.role || ''}
                      placeholder="e.g. Lead Developer"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Project URL</label>
                    <input
                      name="projectUrl"
                      defaultValue={activeItem?.projectUrl || ''}
                      placeholder="https://..."
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Technologies / Skills (comma-separated)</label>
                    <input
                      name="skills"
                      defaultValue={activeItem?.skills?.join(', ') || ''}
                      placeholder="TypeScript, React, PostgreSQL"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      defaultValue={activeItem?.description || ''}
                      rows={3}
                      className="form-textarea"
                    />
                  </div>
                </div>
              )}

              {tab === 'skills' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Skill Name</label>
                    <input
                      name="name"
                      defaultValue={activeItem?.name || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      name="category"
                      defaultValue={activeItem?.category || ''}
                      placeholder="Backend, Frontend, Cloud, etc."
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Proficiency</label>
                    <select
                      name="proficiency"
                      defaultValue={activeItem?.proficiency || 'ADVANCED'}
                      className="form-input"
                    >
                      <option value="BEGINNER">BEGINNER</option>
                      <option value="INTERMEDIATE">INTERMEDIATE</option>
                      <option value="ADVANCED">ADVANCED</option>
                      <option value="EXPERT">EXPERT</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Years of Experience</label>
                    <input
                      type="number"
                      step="0.5"
                      name="yearsExperience"
                      defaultValue={activeItem?.yearsExperience || ''}
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              {tab === 'languages' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Language</label>
                    <input
                      name="language"
                      defaultValue={activeItem?.language || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Proficiency</label>
                    <select
                      name="proficiency"
                      defaultValue={activeItem?.proficiency || 'PROFICIENT'}
                      className="form-input"
                    >
                      <option value="NATIVE">NATIVE</option>
                      <option value="FLUENT">FLUENT</option>
                      <option value="PROFICIENT">PROFICIENT</option>
                      <option value="INTERMEDIATE">INTERMEDIATE</option>
                      <option value="BASIC">BASIC</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">CEFR Level (Optional)</label>
                    <input
                      name="cefrLevel"
                      defaultValue={activeItem?.cefrLevel || ''}
                      placeholder="C1, C2, B2, etc."
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              {tab === 'certifications' && (
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Certification Name</label>
                    <input
                      name="name"
                      defaultValue={activeItem?.name || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Issuing Organization</label>
                    <input
                      name="issuingOrganization"
                      defaultValue={activeItem?.issuingOrganization || ''}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Issue Date</label>
                    <input
                      name="issueDate"
                      defaultValue={activeItem?.issueDate || ''}
                      placeholder="YYYY-MM"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiration Date</label>
                    <input
                      name="expirationDate"
                      defaultValue={activeItem?.expirationDate || ''}
                      placeholder="YYYY-MM"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Credential URL</label>
                    <input
                      name="credentialUrl"
                      defaultValue={activeItem?.credentialUrl || ''}
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              {tab === 'links' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Platform / Label</label>
                    <input
                      name="label"
                      defaultValue={activeItem?.label || ''}
                      placeholder="LinkedIn, GitHub, Portfolio"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">URL</label>
                    <input
                      type="url"
                      name="url"
                      defaultValue={activeItem?.url || ''}
                      placeholder="https://..."
                      required
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              {tab === 'facts' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      name="category"
                      defaultValue={activeItem?.category || 'EXPERIENCE'}
                      className="form-input"
                    >
                      <option value="EXPERIENCE">EXPERIENCE</option>
                      <option value="SKILL">SKILL</option>
                      <option value="EDUCATION">EDUCATION</option>
                      <option value="AUTHORIZATION">AUTHORIZATION</option>
                      <option value="COMPENSATION">COMPENSATION</option>
                      <option value="LOGISTICS">LOGISTICS</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fact Key Identifier</label>
                    <input
                      name="factKey"
                      defaultValue={activeItem?.factKey || ''}
                      placeholder="e.g. years_experience_ts"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Verifiable Statement</label>
                    <textarea
                      name="statement"
                      defaultValue={activeItem?.statement || ''}
                      placeholder="Factual proposition..."
                      required
                      rows={2}
                      className="form-textarea"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Verification Status</label>
                    <select
                      name="verificationStatus"
                      defaultValue={activeItem?.verificationStatus || 'VERIFIED'}
                      className="form-input"
                    >
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="UNVERIFIED">UNVERIFIED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                  <div
                    className="form-group"
                    style={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem' }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="allowAiUse"
                        defaultChecked={activeItem?.allowAiUse !== false}
                      />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        Allow AI Use in Applications
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop: '1.5rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setModalMode(null);
                    setActiveItem(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
