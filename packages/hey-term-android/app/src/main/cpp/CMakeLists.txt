# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Builds whisper.cpp (https://github.com/ggml-org/whisper.cpp, MIT) from
# source at CI configure time via FetchContent -- the same real, self-built
# engine the Termux version compiles on-device, just linked directly into
# this app as a native library instead of run as a standalone binary. Not
# vendored into the repo: it's large, and cloning fresh at build time means
# this always builds against the real upstream source, not a stale copy.
cmake_minimum_required(VERSION 3.22.1)
project(heyterm_whisper)

include(FetchContent)
FetchContent_Declare(
    whispercpp
    GIT_REPOSITORY https://github.com/ggml-org/whisper.cpp.git
    GIT_TAG master
    GIT_SHALLOW TRUE
)
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_TESTS OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(whispercpp)

add_library(heyterm_whisper SHARED whisper_jni.cpp)

find_library(log-lib log)

target_link_libraries(heyterm_whisper
    whisper
    ${log-lib}
    android
)

target_include_directories(heyterm_whisper PRIVATE
    ${whispercpp_SOURCE_DIR}/include
    ${whispercpp_SOURCE_DIR}/ggml/include
)
