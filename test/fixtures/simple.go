package main

import "os"

// Ignored error - bad practice
func loadFile() string {
	data, _ := os.ReadFile("config.json")
	return string(data)
}

func main() {
	loadFile()
}
