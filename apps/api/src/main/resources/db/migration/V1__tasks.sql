CREATE TABLE projects (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_projects_name UNIQUE (name)
);

CREATE TABLE tasks (
    id VARCHAR(36) NOT NULL,
    project_id BIGINT NOT NULL,
    title VARCHAR(300) NOT NULL,
    minutes INT NOT NULL,
    priority INT NOT NULL,
    done BOOLEAN NOT NULL,
    due DATE NULL,
    revision INT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT ck_tasks_minutes CHECK (minutes BETWEEN 1 AND 1440),
    CONSTRAINT ck_tasks_priority CHECK (priority BETWEEN 1 AND 3),
    CONSTRAINT ck_tasks_revision CHECK (revision >= 1)
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
