package dev.goodjob

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class GoodjobApiApplication

fun main(args: Array<String>) {
	runApplication<GoodjobApiApplication>(*args)
}
