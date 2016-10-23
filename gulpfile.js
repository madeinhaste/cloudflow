var gulp = require('gulp');
var concat = require('gulp-concat');
var usemin = require('gulp-usemin');
var uglify = require('gulp-uglify');

gulp.task('usemin', function() {
    gulp.src('static/iframe.html')
        .pipe(usemin({
            js: [ uglify() ]
        }))
        .pipe(gulp.dest('build'));
});

gulp.task('copy-assets', function(){
    var assets = [
        'data/**',
        'fonts/*',
        'images/**',
        'sounds/**',
        'styles/*',
        'scripts/**',
        'shaders/**',
    ];

    gulp.src(assets, { cwd: 'static', base: 'static' })
        .pipe(gulp.dest('build'));
});

gulp.task('default', [
    'copy-assets',
    'usemin'
]);
