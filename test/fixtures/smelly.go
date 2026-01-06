package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"sync"
)

// Smell: Exported package-level variable
var GlobalCounter int = 0

// Smell: Ignored error return
func loadConfig() string {
	data, _ := ioutil.ReadFile("config.json") // BAD: error ignored
	return string(data)
}

// Smell: Missing context.Context for I/O operation
func fetchData(url string) ([]byte, error) {
	// This should accept context.Context as first parameter
	return nil, nil
}

// Smell: Mutex without defer unlock
func unsafeIncrement(mu *sync.Mutex, counter *int) {
	mu.Lock()
	*counter++
	// BAD: No defer mu.Unlock() - if panic occurs, mutex stays locked
	mu.Unlock()
}

// Smell: Empty interface abuse
func processAnything(data interface{}) interface{} {
	// BAD: Using interface{} loses type safety
	return data
}

// Smell: Goroutine leak potential
func startWorker() {
	go func() {
		for {
			// BAD: Infinite loop with no way to stop
			fmt.Println("working...")
		}
	}()
}

// Smell: Long function with deep nesting
func complexFunction(items []string) error {
	for _, item := range items {
		if item != "" {
			for i := 0; i < 10; i++ {
				if i%2 == 0 {
					switch item {
					case "a":
						if true {
							for j := 0; j < 5; j++ {
								// Deep nesting - hard to follow
								fmt.Println(item, i, j)
							}
						}
					case "b":
						fmt.Println("b")
					}
				}
			}
		}
	}
	return nil
}

// Smell: Missing error check
func writeFile() {
	f, err := os.Create("output.txt")
	// BAD: Using f before checking err
	f.WriteString("hello")
	if err != nil {
		return
	}
	f.Close() // Also BAD: ignoring close error
}

// Smell: Naked return in long function
func calculate(x, y int) (result int, err error) {
	if x < 0 {
		err = fmt.Errorf("x must be positive")
		return // Naked return - hard to follow what's being returned
	}

	if y < 0 {
		err = fmt.Errorf("y must be positive")
		return
	}

	result = x + y
	return
}

// Smell: Large struct passed by value
type HugeStruct struct {
	Data   [1024]byte
	Buffer [4096]byte
	Name   string
}

func processHuge(h HugeStruct) { // BAD: Should be *HugeStruct
	fmt.Println(h.Name)
}

// Smell: init() with complex logic
func init() {
	// BAD: Complex initialization that could fail
	data, err := ioutil.ReadFile("startup.conf")
	if err != nil {
		panic(err) // Panic in init is bad practice
	}
	fmt.Println(string(data))
}

func main() {
	GlobalCounter++
	loadConfig()
	startWorker()
}
