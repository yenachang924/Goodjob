package dev.goodjob.tasks

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.date

object Projects : Table("projects") {
    val id = long("id").autoIncrement()
    val name = varchar("name", 100).uniqueIndex()
    override val primaryKey = PrimaryKey(id)
}

object Tasks : Table("tasks") {
    val id = varchar("id", 36)
    val projectId = long("project_id").references(Projects.id)
    val title = varchar("title", 300)
    val minutes = integer("minutes")
    val priority = integer("priority")
    val done = bool("done")
    val due = date("due").nullable()
    val revision = integer("revision")
    override val primaryKey = PrimaryKey(id)
}
