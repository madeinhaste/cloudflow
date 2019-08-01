var gulp = require('gulp');
var concat = require('gulp-concat');
var usemin = require('gulp-usemin');
var terser = require('gulp-terser');

gulp.task('usemin', function() {
    return gulp.src('static/iframe.html')
        .pipe(usemin({
            js: [ terser() ]
        }))
        .pipe(gulp.dest('build'));
});

gulp.task('copy-assets', function() {
    var assets = [
        'data/**',
        'fonts/**',
        'images/**',
        'sounds/**',
        'styles/**',
        'scripts/**',
        'shaders/**',
    ];

    return gulp.src(assets, { cwd: 'static', base: 'static' })
        .pipe(gulp.dest('build'));
});

gulp.task('default', gulp.series('copy-assets', 'usemin'));
